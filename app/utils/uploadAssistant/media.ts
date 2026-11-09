/**
 * In-browser media analysis for the upload assistant. Heavy WebAssembly
 * modules are loaded on demand, from this site (no CDN):
 * - mediainfo.js for the MediaInfo report
 * - screenshots with the browser's own decoder (<video> + canvas), falling
 *   back to ffmpeg.wasm for what it cannot play (HEVC in MKV, AVI...). ffmpeg
 *   reads the file in place through WORKERFS: nothing is copied in memory.
 */

import { cleanMediaInfoText } from '~~/shared/utils/release/mediainfo';

export interface MediaInfoResult {
  json: string;
  text: string;
}

export async function analyzeMedia(file: File): Promise<MediaInfoResult> {
  const [{ default: mediaInfoFactory }, { default: wasmUrl }] = await Promise.all([
    import('mediainfo.js'),
    import('mediainfo.js/MediaInfoModule.wasm?url'),
  ]);
  const locateFile = (path: string, prefix: string) =>
    path === 'MediaInfoModule.wasm' ? wasmUrl : `${prefix}${path}`;
  const readChunk = async (size: number, offset: number) =>
    new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
  const getSize = () => file.size;

  const json = await mediaInfoFactory({ format: 'JSON', locateFile });
  const text = await mediaInfoFactory({ format: 'text', locateFile });
  try {
    return {
      json: await json.analyzeData(getSize, readChunk),
      // The text report names the file: give it the real name
      text: cleanMediaInfoText((await text.analyzeData(getSize, readChunk)).replace(
        /^(Complete name\s*:\s*).*$/m,
        `$1${file.name}`
      )),
    };
  } finally {
    json.close();
    text.close();
  }
}

/** Timestamps spread over the video, skipping intro and credits */
export function screenshotTimes(duration: number, count: number): number[] {
  const start = duration * 0.08;
  const span = duration * 0.84;
  return Array.from({ length: count }, (_, i) => start + (span * (i + 0.5)) / count);
}

const MAX_WIDTH = 1920;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), 'image/jpeg', 0.9)
  );
}

function once(target: EventTarget, ok: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => cleanup(new Error('timeout')), timeoutMs);
    const onOk = () => cleanup();
    const onError = () => cleanup(new Error('media error'));
    function cleanup(err?: Error) {
      clearTimeout(timer);
      target.removeEventListener(ok, onOk);
      target.removeEventListener('error', onError);
      if (err) reject(err);
      else resolve();
    }
    target.addEventListener(ok, onOk);
    target.addEventListener('error', onError);
  });
}

/** With the browser's decoder; null when it cannot show this video */
async function nativeScreenshots(file: File, times: number[]): Promise<Blob[] | null> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  try {
    video.src = url;
    await once(video, 'loadeddata', 15_000);
    if (!video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const shots: Blob[] = [];
    for (const time of times) {
      video.currentTime = Math.min(time, Math.max(0, video.duration - 1));
      await once(video, 'seeked', 15_000);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Audio decoded but no picture: the frame is uniformly black
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < sample.length; i += 4 * 97) lit += sample[i]! + sample[i + 1]! + sample[i + 2]!;
      if (lit === 0 && shots.length === 0) return null;
      shots.push(await canvasToJpeg(canvas));
    }
    return shots;
  } catch (err) {
    console.warn('[Upload assistant] Browser decoder unavailable, using ffmpeg:', err);
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ffmpeg stopped answering')), ms);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (err) => (clearTimeout(timer), reject(err))
    );
  });
}

/** JPEG keeps screenshots well under the image host's 10 MB limit */
async function pngToJpeg(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToJpeg(canvas);
}

async function ffmpegScreenshots(file: File, times: number[], onStep?: (done: number) => void): Promise<Blob[]> {
  const [{ FFmpeg, FFFSType }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/core?url'),
    import('@ffmpeg/core/wasm?url'),
  ]);
  const ffmpeg = new FFmpeg();
  // ffmpeg's own output, for bug reports (DevTools > Console > Verbose)
  ffmpeg.on('log', ({ message }) => console.debug('[ffmpeg]', message));
  await withTimeout(ffmpeg.load({ coreURL, wasmURL }), 120_000);
  console.debug('[Upload assistant] ffmpeg loaded');
  try {
    await ffmpeg.createDir('/in');
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, '/in');
    const shots: Blob[] = [];
    for (const [i, time] of times.entries()) {
      // PNG, not JPEG: the MJPEG encoder of @ffmpeg/core 0.12 crashes
      // ("memory access out of bounds"); the browser converts to JPEG below
      const out = `shot${i}.png`;
      // -ss before -i: fast seek on the nearest keyframe, then exact decode.
      // -nostdin: no keyboard input in a worker. ffmpeg's timeout (ms) bounds a
      // file that decodes forever, withTimeout a worker that stops answering.
      const code = await withTimeout(
        ffmpeg.exec(
          [
            '-nostdin', '-ss', time.toFixed(2), '-i', `/in/${file.name}`,
            '-map', '0:v:0', '-an', '-sn', '-dn',
            '-frames:v', '1', '-update', '1', '-vf', `scale='min(${MAX_WIDTH},iw)':-2`, out,
          ],
          90_000
        ),
        120_000
      );
      if (code !== 0) throw new Error(`ffmpeg could not decode this video (code ${code})`);
      const data = await ffmpeg.readFile(out);
      if (!(data instanceof Uint8Array) || data.length === 0) throw new Error('No frame decoded');
      shots.push(await pngToJpeg(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'image/png' })));
      await ffmpeg.deleteFile(out);
      onStep?.(i + 1);
    }
    return shots;
  } finally {
    ffmpeg.terminate();
  }
}

export interface ScreenshotResult {
  shots: Blob[];
  engine: 'browser' | 'ffmpeg';
}

export async function captureScreenshots(
  file: File,
  duration: number,
  count: number,
  onStep?: (done: number, engine: ScreenshotResult['engine']) => void
): Promise<ScreenshotResult> {
  const times = screenshotTimes(duration, count);
  const native = await nativeScreenshots(file, times);
  if (native) {
    onStep?.(native.length, 'browser');
    return { shots: native, engine: 'browser' };
  }
  const shots = await ffmpegScreenshots(file, times, (done) => onStep?.(done, 'ffmpeg'));
  return { shots, engine: 'ffmpeg' };
}
