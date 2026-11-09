<template>
  <div class="max-w-5xl mx-auto">
    <div class="mb-6">
      <h2 class="text-2xl font-semibold tracking-tight text-text-primary">{{ t('assistant.title') }}</h2>
      <p class="text-sm text-text-muted mt-0.5">{{ t('assistant.subtitle') }}</p>
    </div>

    <!-- 1. Files -->
    <div
      v-if="!picked"
      class="card mb-6 border-dashed transition-colors"
      :class="dragging ? 'border-text-primary bg-bg-secondary' : ''"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="card-body py-12 text-center space-y-4">
        <Icon name="ph:upload-simple" class="text-4xl text-text-muted mx-auto" />
        <p class="text-sm text-text-primary">{{ t('assistant.drop') }}</p>
        <div class="flex flex-wrap justify-center gap-3">
          <label class="btn btn-primary cursor-pointer">
            <Icon name="ph:file-video" aria-hidden="true" />{{ t('assistant.pickFile') }}
            <input type="file" class="sr-only" @change="onPick($event)" />
          </label>
          <label class="btn cursor-pointer">
            <Icon name="ph:folder-simple" aria-hidden="true" />{{ t('assistant.pickFolder') }}
            <input type="file" class="sr-only" webkitdirectory multiple @change="onPick($event)" />
          </label>
        </div>
        <label class="inline-flex items-center gap-2 text-xs text-text-muted">
          <input v-model="form.adult" type="checkbox" />
          {{ t('assistant.adult') }}
        </label>
        <p class="text-xs text-text-muted">{{ t('assistant.private') }}</p>
      </div>
    </div>

    <template v-else>
      <!-- Release overview and progress -->
      <div class="card mb-6">
        <div class="card-header flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <Icon :name="picked.folder ? 'ph:folder-simple' : 'ph:file-video'" class="text-text-muted shrink-0" />
            <h3 class="text-sm font-medium text-text-primary truncate">{{ picked.name }}</h3>
          </div>
          <button type="button" class="btn-ghost text-xs px-2 py-1 rounded" :disabled="publishing" @click="reset">
            {{ t('assistant.change') }}
          </button>
        </div>
        <div class="card-body space-y-3 text-sm">
          <p class="text-text-muted">
            {{ t('assistant.fileCount', { count: picked.files.length, size: formatSize(picked.totalSize, sizeLang) }, picked.files.length) }}
          </p>
          <StepLine :label="t('assistant.steps.mediainfo')" :state="steps.mediainfo" :detail="mediaError" />
          <StepLine
            :label="t('assistant.steps.screenshots')"
            :state="steps.screenshots"
            :detail="shotsDetail"
          />
          <StepLine
            :label="t('assistant.steps.hash')"
            :state="steps.hash"
            :progress="hashProgress"
            :detail="hashError"
          />
        </div>
      </div>

      <!-- Screenshots -->
      <div v-if="shots.length" class="card mb-6">
        <div class="card-header">
          <h3 class="text-sm font-medium text-text-primary">{{ t('assistant.screenshots') }}</h3>
        </div>
        <div class="card-body">
          <p class="text-xs text-text-muted mb-3">{{ t('assistant.screenshotsHint') }}</p>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label
              v-for="(shot, i) in shots"
              :key="shot.url"
              class="relative block rounded overflow-hidden border cursor-pointer"
              :class="shot.selected ? 'border-text-primary' : 'border-border opacity-40'"
            >
              <img :src="shot.url" alt="" class="w-full aspect-video object-cover" />
              <input v-model="shot.selected" type="checkbox" class="absolute top-2 left-2" :aria-label="t('assistant.useShot', { n: i + 1 })" />
              <span class="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-scrim/70 text-paper">
                <Icon v-if="shot.state === 'uploading'" name="ph:spinner" class="animate-spin align-[-1px]" />
                <Icon v-else-if="shot.state === 'hosted'" name="ph:cloud-check" class="align-[-1px]" />
                <Icon v-else-if="shot.state === 'error'" name="ph:warning" class="align-[-1px]" />
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="card mb-6">
        <div class="card-header">
          <h3 class="text-sm font-medium text-text-primary">{{ t('assistant.details') }}</h3>
        </div>
        <div class="card-body grid gap-4 md:grid-cols-2">
          <label class="block md:col-span-2">
            <span :class="labelClass">{{ t('assistant.name') }}</span>
            <input v-model="form.name" type="text" maxlength="255" :class="inputClass" />
          </label>
          <label class="block">
            <span :class="labelClass">{{ t('assistant.category') }}</span>
            <select v-model="form.categoryId" :class="inputClass">
              <option value="">{{ t('assistant.noCategory') }}</option>
              <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
          </label>
          <label class="block">
            <span :class="labelClass">{{ t('assistant.language') }}</span>
            <select v-model="form.lang" :class="inputClass">
              <option v-for="l in DESCRIPTION_LANGUAGES" :key="l" :value="l">{{ languageLabel(l) }}</option>
            </select>
          </label>
          <label class="block">
            <span :class="labelClass">{{ t('assistant.releaseTitle') }}</span>
            <input v-model="form.title" type="text" :class="inputClass" />
          </label>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="id in (['imdbId', 'tmdbId', 'tvdbId'] as const)" :key="id" class="block">
              <span :class="labelClass">{{ t(`assistant.ids.${id}`) }}</span>
              <input v-model="form[id]" type="text" :class="inputClass" />
            </label>
          </div>
          <div v-if="config?.tags.length" class="md:col-span-2">
            <span :class="labelClass">{{ t('assistant.tags') }}</span>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="tag in config.tags"
                :key="tag.id"
                class="text-xs px-2 py-1 rounded border cursor-pointer"
                :class="form.tagIds.includes(tag.id) ? 'border-text-primary text-text-primary' : 'border-border text-text-muted'"
              >
                <input v-model="form.tagIds" type="checkbox" :value="tag.id" class="sr-only" />
                {{ tag.name }}
              </label>
            </div>
          </div>
          <label class="block md:col-span-2">
            <span :class="labelClass">{{ t('assistant.notes') }}</span>
            <textarea v-model="form.notes" rows="2" :class="inputClass" />
          </label>
        </div>
      </div>

      <!-- Description -->
      <div class="card mb-6">
        <div class="card-header flex items-center justify-between gap-3">
          <h3 class="text-sm font-medium text-text-primary">{{ t('assistant.description') }}</h3>
          <div class="flex items-center gap-2">
            <button v-if="descriptionEdited" type="button" class="btn-ghost text-xs px-2 py-1 rounded" @click="regenerate">
              {{ t('assistant.regenerate') }}
            </button>
            <button type="button" class="btn-ghost text-xs px-2 py-1 rounded" @click="copyDescription">
              <Icon :name="copied ? 'ph:check' : 'ph:copy'" class="align-[-2px]" />
              {{ t('assistant.copyBbcode') }}
            </button>
          </div>
        </div>
        <div class="card-body grid gap-4 lg:grid-cols-2">
          <textarea
            :value="description"
            rows="18"
            spellcheck="false"
            :class="inputClass"
            class="font-mono text-xs"
            @input="onDescriptionInput"
          />
          <ClientOnly>
            <div class="description-preview text-sm text-text-secondary border border-border rounded p-3 overflow-auto max-h-[28rem]" v-html="preview" />
          </ClientOnly>
        </div>
      </div>

      <!-- Publish -->
      <div class="card mb-6">
        <div class="card-body space-y-3">
          <div v-if="published" class="p-3 rounded border border-success/30 bg-success/10 text-sm space-y-2">
            <p class="text-success font-medium">
              <Icon name="ph:check-circle" class="align-[-2px]" />
              {{ published.existing ? t('assistant.alreadyExists') : t('assistant.published') }}
            </p>
            <p class="text-text-muted">{{ t('assistant.seedHint') }}</p>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="btn btn-primary" @click="downloadTorrent">
                <Icon name="ph:download-simple" aria-hidden="true" />{{ t('assistant.download') }}
              </button>
              <NuxtLink :to="`/torrents/${published.infoHash}`" class="btn">{{ t('assistant.open') }}</NuxtLink>
            </div>
          </div>
          <template v-else>
            <p v-if="publishError" class="text-sm text-red-400">{{ publishError }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="btn btn-primary" :disabled="!canPublish" @click="publish">
                <Icon v-if="publishing" name="ph:spinner" class="animate-spin" aria-hidden="true" />
                <Icon v-else name="ph:paper-plane-tilt" aria-hidden="true" />
                {{ t('assistant.publish') }}
              </button>
              <button type="button" class="btn" :disabled="!built" @click="downloadTorrent">
                <Icon name="ph:download-simple" aria-hidden="true" />{{ t('assistant.downloadOnly') }}
              </button>
              <span v-if="!built" class="text-xs text-text-muted">{{ t('assistant.waitHash') }}</span>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- CLI -->
    <div class="card mb-6">
      <div class="card-header flex items-center gap-2">
        <Icon name="ph:terminal-window" class="text-text-muted" />
        <h3 class="text-sm font-medium text-text-primary">{{ t('assistant.cli.title') }}</h3>
      </div>
      <div class="card-body space-y-3 text-sm">
        <p class="text-text-muted">{{ t('assistant.cli.intro') }}</p>
        <pre class="bg-bg-tertiary border border-border rounded p-3 text-xs overflow-x-auto">{{ cliCommand }}</pre>
        <p class="text-xs text-text-muted">
          {{ t('assistant.cli.requirements') }}
          <NuxtLink to="/integrations" class="underline underline-offset-2">{{ t('assistant.cli.apiKey') }}</NuxtLink>
        </p>
        <a href="/tools/trackarr-upload.mjs" download class="btn inline-flex">
          <Icon name="ph:download-simple" aria-hidden="true" />{{ t('assistant.cli.download') }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildDescription, formatSize, type Screenshot } from '~~/shared/utils/release/description';
import { DESCRIPTION_LANGUAGES, isDescriptionLanguage, type DescriptionLanguage } from '~~/shared/utils/release/labels';
import { summarizeMediaInfo, type MediaSummary } from '~~/shared/utils/release/mediainfo';
import { parseReleaseName, stripVideoExtension } from '~~/shared/utils/release/releaseName';
import type { BuiltTorrent } from '~~/shared/utils/release/torrent';
import { mainVideo, releaseFromDrop, releaseFromFileList, type PickedRelease } from '~/utils/uploadAssistant/files';
import { analyzeMedia, captureScreenshots, type MediaInfoResult } from '~/utils/uploadAssistant/media';
import { hashRelease } from '~/utils/uploadAssistant/hash';

type StepState = 'idle' | 'running' | 'done' | 'skipped' | 'error';

interface AssistantConfig {
  siteName: string;
  announceUrl: string;
  source: string;
  categories: { id: string; name: string; parentId: string | null }[];
  tags: { id: string; name: string }[];
  screenshots: { host: string; maxPerUpload: number };
}

interface Shot {
  blob: Blob;
  url: string;
  selected: boolean;
  state: 'local' | 'uploading' | 'hosted' | 'error';
  hosted: Screenshot | null;
}

const SCREENSHOT_COUNT = 6;

const { t, locale } = useI18n();
const requestUrl = useRequestURL();

const inputClass =
  'w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20';
const labelClass = 'block text-xs font-medium text-text-muted mb-1';

const { data: config } = await useFetch<AssistantConfig>('/api/upload-assistant/config');

const dragging = ref(false);
const picked = shallowRef<PickedRelease | null>(null);
const steps = reactive<Record<'mediainfo' | 'screenshots' | 'hash', StepState>>({
  mediainfo: 'idle',
  screenshots: 'idle',
  hash: 'idle',
});
const mediaInfo = shallowRef<MediaInfoResult | null>(null);
const summary = computed<MediaSummary | null>(() =>
  mediaInfo.value ? summarizeMediaInfo(mediaInfo.value.json) : null
);
const mediaError = ref('');
const shots = ref<Shot[]>([]);
const shotsDetail = ref('');
const hashProgress = ref(0);
const hashError = ref('');
const built = shallowRef<BuiltTorrent | null>(null);

const form = reactive({
  name: '',
  title: '',
  categoryId: '',
  tagIds: [] as string[],
  imdbId: '',
  tmdbId: '',
  tvdbId: '',
  lang: (isDescriptionLanguage(locale.value) ? locale.value : 'en') as DescriptionLanguage,
  notes: '',
  adult: false,
});

const description = ref('');
const descriptionEdited = ref(false);
const copied = ref(false);
const publishing = ref(false);
const publishError = ref('');
const published = ref<{ infoHash: string; existing: boolean } | null>(null);

const sizeLang = computed<DescriptionLanguage>(() => (isDescriptionLanguage(locale.value) ? locale.value : 'en'));

const categoryOptions = computed(() => {
  const all = config.value?.categories ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));
  return all
    .map((c) => ({ id: c.id, label: c.parentId ? `${byId.get(c.parentId)?.name ?? ''} › ${c.name}` : c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

function languageLabel(code: string) {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const preview = computed(() => renderDescription(description.value));

const cliCommand = computed(
  () =>
    `node trackarr-upload.mjs "/path/to/release" --url ${requestUrl.origin} --key YOUR_API_KEY --lang ${form.lang}${form.adult ? ' --adult' : ''}`
);

const canPublish = computed(
  () => Boolean(built.value) && !publishing.value && form.name.trim().length > 0 && steps.screenshots !== 'running'
);

// Description follows the inputs until edited by hand
function generate(): string {
  if (!picked.value) return '';
  const release = parseReleaseName(picked.value.name);
  return buildDescription({
    lang: form.lang,
    title: form.title || release.title,
    release,
    summary: summary.value,
    mediaInfoText: mediaInfo.value?.text,
    screenshots: shots.value.filter((s) => s.selected && s.hosted).map((s) => s.hosted!),
    files: picked.value.folder
      ? picked.value.files.map((f) => ({ path: f.path.join('/'), size: f.file.size }))
      : [],
    notes: form.notes,
  });
}

watchEffect(() => {
  const next = generate();
  if (!descriptionEdited.value) description.value = next;
});

function onDescriptionInput(event: Event) {
  description.value = (event.target as HTMLTextAreaElement).value;
  descriptionEdited.value = true;
}

function regenerate() {
  descriptionEdited.value = false;
  description.value = generate();
}

async function copyDescription() {
  try {
    await navigator.clipboard.writeText(description.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard refused: the text stays selectable
  }
}

// A dropped folder is read asynchronously: any later choice makes it stale
let pickToken = 0;

async function onPick(event: Event) {
  pickToken++;
  const input = event.target as HTMLInputElement;
  if (input.files?.length) start(releaseFromFileList(input.files));
  input.value = '';
}

async function onDrop(event: DragEvent) {
  dragging.value = false;
  if (!event.dataTransfer) return;
  const token = ++pickToken;
  const release = await releaseFromDrop(event.dataTransfer);
  // Another file was picked meanwhile, or a release is already in progress
  if (token !== pickToken || picked.value) return;
  start(release);
}

function reset() {
  // Stop reading the files of the release being replaced
  hashAbort?.abort();
  hashAbort = null;
  for (const s of shots.value) URL.revokeObjectURL(s.url);
  picked.value = null;
  mediaInfo.value = null;
  shots.value = [];
  built.value = null;
  published.value = null;
  publishError.value = '';
  mediaError.value = '';
  hashError.value = '';
  shotsDetail.value = '';
  hashProgress.value = 0;
  descriptionEdited.value = false;
  Object.assign(steps, { mediainfo: 'idle', screenshots: 'idle', hash: 'idle' });
}

function start(release: PickedRelease | null) {
  if (!release || !config.value) return;
  reset();
  picked.value = release;
  const parsed = parseReleaseName(release.name);
  form.name = release.folder ? release.name : stripVideoExtension(release.name);
  form.title = parsed.title;
  void runMedia(release).finally(() => runHash(release));
}

// Work for a release the user replaced ("Change") must not touch the page:
// every write after an await checks the release is still the one shown
const isCurrent = (release: PickedRelease) => picked.value === release;

async function runMedia(release: PickedRelease) {
  const video = mainVideo(release);
  if (!video) {
    steps.mediainfo = 'skipped';
    steps.screenshots = 'skipped';
    return;
  }
  steps.mediainfo = 'running';
  try {
    const result = await analyzeMedia(video);
    if (!isCurrent(release)) return;
    mediaInfo.value = result;
    steps.mediainfo = 'done';
  } catch (err) {
    if (!isCurrent(release)) return;
    steps.mediainfo = 'error';
    mediaError.value = errorText(err);
    console.error('[Upload assistant] MediaInfo failed:', err);
  }

  const duration = summary.value?.duration;
  if (!duration) {
    steps.screenshots = 'skipped';
    return;
  }
  steps.screenshots = 'running';
  try {
    const result = await captureScreenshots(video, duration, SCREENSHOT_COUNT, (done, engine) => {
      if (isCurrent(release)) shotsDetail.value = t(`assistant.engine.${engine}`, { done, total: SCREENSHOT_COUNT });
    });
    if (!isCurrent(release)) return;
    shots.value = result.shots.map((blob) => ({
      blob,
      url: URL.createObjectURL(blob),
      selected: true,
      state: 'local',
      hosted: null,
    }));
    shotsDetail.value = t(`assistant.engine.${result.engine}`, { done: result.shots.length, total: SCREENSHOT_COUNT });
    await hostShots(release);
    if (!isCurrent(release)) return;
    steps.screenshots = shots.value.some((s) => s.state === 'error') ? 'error' : 'done';
  } catch (err) {
    if (!isCurrent(release)) return;
    steps.screenshots = 'error';
    shotsDetail.value = errorText(err);
    console.error('[Upload assistant] Screenshots failed:', err);
  }
}

/** Send the screenshots to the image host, through this site */
async function hostShots(release: PickedRelease) {
  for (const shot of shots.value) {
    if (!isCurrent(release)) return;
    if (shot.hosted || !shot.selected) continue;
    shot.state = 'uploading';
    try {
      const body = new FormData();
      body.append('image', shot.blob, 'screenshot.jpg');
      body.append('adult', form.adult ? '1' : '0');
      shot.hosted = await $fetch<Screenshot>('/api/upload-assistant/screenshot', { method: 'POST', body });
      shot.state = 'hosted';
    } catch (err) {
      shot.state = 'error';
      console.error('[Upload assistant] Screenshot upload failed:', err);
    }
  }
}

let hashAbort: AbortController | null = null;

async function runHash(release: PickedRelease) {
  if (!config.value || !isCurrent(release)) return;
  hashAbort = new AbortController();
  const { signal } = hashAbort;
  steps.hash = 'running';
  try {
    const result = await hashRelease(release, {
      announce: config.value.announceUrl,
      source: config.value.source,
      signal,
      onProgress: (done, total) => {
        if (isCurrent(release)) hashProgress.value = Math.floor((done / total) * 100);
      },
    });
    if (!isCurrent(release)) return;
    built.value = result;
    steps.hash = 'done';
  } catch (err) {
    if (!isCurrent(release) || signal.aborted) return;
    steps.hash = 'error';
    hashError.value = errorText(err);
    console.error('[Upload assistant] Hashing failed:', err);
  }
}

/** ffmpeg.wasm and workers do not always throw Error objects */
function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : (err as { message?: unknown })?.message;
  return typeof message === 'string' && message ? message : t('assistant.unknownError');
}

function torrentFileName() {
  return `${(form.name || picked.value?.name || 'release').replace(/[\\/:*?"<>|]+/g, '_')}.torrent`;
}

function downloadTorrent() {
  if (!built.value) return;
  const url = URL.createObjectURL(new Blob([built.value.torrent as Uint8Array<ArrayBuffer>], { type: 'application/x-bittorrent' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = torrentFileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function publish() {
  if (!built.value) return;
  publishing.value = true;
  publishError.value = '';
  try {
    // Screenshots selected after a failed upload get another try
    if (picked.value && shots.value.some((s) => s.selected && !s.hosted)) await hostShots(picked.value);
    const body = new FormData();
    body.append('torrent', new Blob([built.value.torrent as Uint8Array<ArrayBuffer>]), torrentFileName());
    body.append('name', form.name.trim());
    body.append('description', description.value);
    if (form.categoryId) body.append('categoryId', form.categoryId);
    if (form.tagIds.length) body.append('tags', JSON.stringify(form.tagIds));
    for (const id of ['imdbId', 'tmdbId', 'tvdbId'] as const) if (form[id].trim()) body.append(id, form[id].trim());
    const result = await $fetch<{ message?: string; data: { infoHash: string } }>('/api/torrents', {
      method: 'POST',
      body,
    });
    published.value = { infoHash: result.data.infoHash, existing: result.message === 'Torrent already exists' };
  } catch (err: any) {
    publishError.value = err.data?.message || t('assistant.publishFailed');
  } finally {
    publishing.value = false;
  }
}

onBeforeUnmount(() => {
  for (const s of shots.value) URL.revokeObjectURL(s.url);
});
</script>

<style scoped>
.description-preview :deep(img) {
  max-width: 100%;
  display: inline-block;
  margin: 0.25rem;
  border-radius: 4px;
}
.description-preview :deep(ul) {
  list-style: revert;
  padding-left: 1.25rem;
}
.description-preview :deep(details) {
  border: 1px solid rgb(var(--line));
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}
.description-preview :deep(summary) {
  cursor: pointer;
  font-weight: 600;
}
.description-preview :deep(pre) {
  overflow-x: auto;
  font-size: 0.75em;
}
</style>
