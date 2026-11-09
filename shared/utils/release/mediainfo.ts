/**
 * MediaInfo JSON (mediainfo.js in the browser, `mediainfo --Output=JSON` in
 * the CLI: same library, same shape) reduced to what a release description
 * shows. Values come as strings or numbers depending on the build.
 */

type Raw = Record<string, unknown>;

export interface VideoTrack {
  codec: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate: number | null;
  bitDepth: number | null;
  hdr: string | null;
}

export interface AudioTrack {
  codec: string;
  channels: string | null;
  bitrate: number | null;
  language: string | null;
  title: string | null;
}

export interface SubtitleTrack {
  format: string;
  language: string | null;
  title: string | null;
  forced: boolean;
}

export interface MediaSummary {
  container: string | null;
  /** Seconds */
  duration: number | null;
  size: number | null;
  /** Bits per second */
  bitrate: number | null;
  video: VideoTrack[];
  audio: AudioTrack[];
  subtitles: SubtitleTrack[];
}

const str = (v: unknown): string | null => {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.split(' / ')[0]);
  return Number.isFinite(n) ? n : null;
};

const yes = (v: unknown) => str(v)?.toLowerCase() === 'yes';

/** 6 channels -> 5.1, 8 -> 7.1, 2 -> 2.0 */
export function channelLayout(count: number | null): string | null {
  if (!count) return null;
  if (count >= 3 && count !== 4) return `${count - 1}.1`;
  return `${count}.0`;
}

function hdrLabel(track: Raw): string | null {
  const formats = [track.HDR_Format, track.HDR_Format_Compatibility, track.HDR_Format_Commercial]
    .map(str)
    .filter(Boolean)
    .join(' / ');
  const labels: string[] = [];
  if (/dolby vision/i.test(formats)) labels.push('Dolby Vision');
  if (/2094 app 4|hdr10\+/i.test(formats)) labels.push('HDR10+');
  else if (/2086|hdr10/i.test(formats)) labels.push('HDR10');
  if (/hlg/i.test(`${formats} ${str(track.transfer_characteristics) ?? ''}`)) labels.push('HLG');
  if (labels.length === 0 && /pq|2084/i.test(str(track.transfer_characteristics) ?? '')) labels.push('HDR');
  return labels.length ? labels.join(' + ') : null;
}

function videoCodec(track: Raw): string {
  const format = str(track.Format) ?? '?';
  const name = format === 'AVC' ? 'H.264' : format === 'HEVC' ? 'H.265 (HEVC)' : format;
  const profile = str(track.Format_Profile);
  return profile && format !== 'AV1' ? `${name} ${profile.split('@')[0]}` : name;
}

function audioCodec(track: Raw): string {
  const commercial = str(track.Format_Commercial_IfAny);
  const format = str(track.Format) ?? '?';
  let name = commercial ?? format;
  const features = `${str(track.Format_AdditionalFeatures) ?? ''} ${commercial ?? ''}`;
  if (/JOC|Atmos/i.test(features) && !/Atmos/i.test(name)) name += ' Atmos';
  return name;
}

/** Parse the JSON (string or object) of one file */
export function summarizeMediaInfo(raw: unknown): MediaSummary {
  let data: unknown = raw;
  if (typeof raw === 'string') data = JSON.parse(raw);
  const media = (data as { media?: { track?: Raw[] } } | null)?.media;
  const tracks = Array.isArray(media?.track) ? media!.track! : [];
  const general = tracks.find((t) => t['@type'] === 'General') ?? {};

  return {
    container: str(general.Format),
    duration: num(general.Duration),
    size: num(general.FileSize),
    bitrate: num(general.OverallBitRate),
    video: tracks
      .filter((t) => t['@type'] === 'Video')
      .map((t) => ({
        codec: videoCodec(t),
        width: num(t.Width),
        height: num(t.Height),
        fps: num(t.FrameRate),
        bitrate: num(t.BitRate) ?? num(t.BitRate_Nominal),
        bitDepth: num(t.BitDepth),
        hdr: hdrLabel(t),
      })),
    audio: tracks
      .filter((t) => t['@type'] === 'Audio')
      .map((t) => ({
        codec: audioCodec(t),
        channels: channelLayout(num(t.Channels)),
        bitrate: num(t.BitRate) ?? num(t.BitRate_Maximum),
        language: str(t.Language),
        title: str(t.Title),
      })),
    subtitles: tracks
      .filter((t) => t['@type'] === 'Text')
      .map((t) => ({
        format: str(t.Format) ?? '?',
        language: str(t.Language),
        title: str(t.Title),
        forced: yes(t.Forced),
      })),
  };
}

/** 2160p, 1080p... from the frame size (cropped widescreen still counts) */
export function resolutionLabel(video: VideoTrack | undefined): string | null {
  if (!video?.width || !video.height) return null;
  const { width, height } = video;
  if (width >= 3800 || height >= 2100) return '2160p';
  if (width >= 2500 || height >= 1400) return '1440p';
  if (width >= 1900 || height >= 1000) return '1080p';
  if (width >= 1200 || height >= 700) return '720p';
  if (height >= 560) return '576p';
  return `${height}p`;
}

/**
 * The text report starts with "Complete name : /home/alice/Downloads/...":
 * keep only the file name, the local path tells about the uploader
 */
export function cleanMediaInfoText(text: string): string {
  return text
    .replace(/^(Complete name\s*:\s*)(.+)$/gim, (_, label: string, path: string) => {
      const name = path.trim().split(/[\\/]/).pop() ?? path;
      return `${label}${name}`;
    })
    .replace(/\r\n/g, '\n')
    .trim();
}
