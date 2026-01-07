<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        class="bg-bg-secondary border border-border rounded shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-tertiary/50"
        >
          <div class="flex items-center gap-2">
            <Icon name="ph:upload-simple-bold" class="text-text-muted" />
            <h3
              class="text-xs font-bold uppercase tracking-widest text-text-primary"
            >
              Upload Torrent
            </h3>
          </div>
          <button
            class="text-text-muted hover:text-white transition-colors"
            @click="close"
          >
            <Icon name="ph:x-bold" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6">
          <!-- File Input -->
          <div v-if="!result" class="space-y-6">
            <div
              class="border border-dashed border-border rounded p-10 text-center hover:border-white/30 hover:bg-white/[0.02] transition-all cursor-pointer group"
              :class="{ 'border-success/50 bg-success/5': selectedFile }"
              @click="triggerFileInput"
              @drop.prevent="handleDrop"
              @dragover.prevent
            >
              <input
                ref="fileInput"
                type="file"
                accept=".torrent"
                class="hidden"
                @change="handleFileSelect"
              />
              <div v-if="!selectedFile" class="flex flex-col items-center">
                <div
                  class="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-4 border border-border group-hover:scale-110 transition-transform"
                >
                  <Icon
                    name="ph:file-arrow-up"
                    class="text-2xl text-text-muted"
                  />
                </div>
                <p
                  class="text-xs font-bold uppercase tracking-wider text-text-secondary"
                >
                  Drop .torrent file
                </p>
                <p class="text-[10px] text-text-muted mt-1 font-mono">
                  or click to browse filesystem
                </p>
              </div>
              <div v-else class="flex flex-col items-center">
                <div
                  class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-4 border border-success/30"
                >
                  <Icon
                    name="ph:check-circle-bold"
                    class="text-2xl text-success"
                  />
                </div>
                <p
                  class="text-xs font-bold text-text-primary truncate max-w-full px-4"
                >
                  {{ selectedFile.name }}
                </p>
                <p class="text-[10px] text-text-muted mt-1 font-mono uppercase">
                  {{ formatSize(selectedFile.size) }}
                </p>
              </div>
            </div>

            <!-- Category Select -->
            <div class="space-y-2">
              <label
                class="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1"
                >Category</label
              >
              <select
                v-model="selectedCategoryId"
                class="input w-full !py-2 text-xs font-bold uppercase tracking-wider"
              >
                <option value="">Select a category...</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <div class="flex items-center justify-between ml-1">
                <label
                  class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
                  >Description (Markdown)</label
                >
                <button
                  type="button"
                  class="text-[10px] font-bold uppercase tracking-widest transition-colors"
                  :class="
                    isPreview
                      ? 'text-white'
                      : 'text-text-muted hover:text-white'
                  "
                  @click="isPreview = !isPreview"
                >
                  {{ isPreview ? 'Edit' : 'Preview' }}
                </button>
              </div>

              <div v-if="!isPreview" class="space-y-0">
                <!-- Toolbar -->
                <div
                  class="flex items-center gap-1 p-1 bg-bg-tertiary border border-border rounded-t-sm border-b-0"
                >
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Bold"
                    @click="insertMarkdown('bold')"
                  >
                    <Icon name="ph:text-b-bold" />
                  </button>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Italic"
                    @click="insertMarkdown('italic')"
                  >
                    <Icon name="ph:text-italic-bold" />
                  </button>
                  <div class="w-px h-3 bg-border mx-1"></div>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Link"
                    @click="insertMarkdown('link')"
                  >
                    <Icon name="ph:link-bold" />
                  </button>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Image"
                    @click="insertMarkdown('image')"
                  >
                    <Icon name="ph:image-bold" />
                  </button>
                  <div class="w-px h-3 bg-border mx-1"></div>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="List"
                    @click="insertMarkdown('list')"
                  >
                    <Icon name="ph:list-bullets-bold" />
                  </button>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Quote"
                    @click="insertMarkdown('quote')"
                  >
                    <Icon name="ph:quotes-bold" />
                  </button>
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Code"
                    @click="insertMarkdown('code')"
                  >
                    <Icon name="ph:code-bold" />
                  </button>
                </div>
                <textarea
                  ref="textareaRef"
                  v-model="description"
                  rows="6"
                  class="input w-full !py-2 text-xs font-medium resize-none rounded-t-none"
                  placeholder="Enter torrent description, images, etc..."
                ></textarea>
              </div>

              <div
                v-else
                class="input w-full min-h-[158px] !py-3 text-xs overflow-y-auto bg-bg-primary/50"
              >
                <div
                  v-if="description"
                  class="prose prose-invert prose-xs max-w-none description-preview"
                  v-html="renderedDescription"
                ></div>
                <div v-else class="text-text-muted italic text-[10px]">
                  Nothing to preview
                </div>
              </div>
            </div>

            <button
              class="btn btn-primary w-full !py-2.5 flex items-center justify-center gap-2 uppercase tracking-widest font-bold text-xs"
              :disabled="!selectedFile || isUploading"
              @click="upload"
            >
              <Icon
                v-if="isUploading"
                name="ph:circle-notch"
                class="animate-spin"
              />
              <Icon v-else name="ph:rocket-launch-bold" />
              <span>{{
                isUploading ? 'Processing...' : 'Initialize Upload'
              }}</span>
            </button>
          </div>

          <!-- Success Result -->
          <div v-else class="space-y-6">
            <div
              class="bg-success/5 border border-success/20 rounded p-4 flex items-start gap-3"
            >
              <Icon
                name="ph:check-circle-fill"
                class="text-success text-xl shrink-0 mt-0.5"
              />
              <div>
                <p
                  class="text-xs font-bold text-success uppercase tracking-wider"
                >
                  {{ result.message }}
                </p>
                <p class="text-[10px] text-text-muted mt-1 font-mono">
                  The object has been successfully indexed.
                </p>
              </div>
            </div>

            <div
              class="space-y-3 bg-bg-tertiary/30 p-4 rounded border border-border"
            >
              <div class="flex justify-between items-center">
                <span
                  class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                  >Name</span
                >
                <span
                  class="text-xs font-medium text-text-primary truncate ml-4"
                  >{{ result.data.name }}</span
                >
              </div>
              <div class="flex justify-between items-center">
                <span
                  class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                  >Hash</span
                >
                <code
                  class="text-[10px] text-text-secondary font-mono bg-bg-primary px-1.5 py-0.5 rounded border border-border"
                  >{{ result.data.infoHash.slice(0, 12) }}...</code
                >
              </div>
              <div class="flex justify-between items-center">
                <span
                  class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                  >Size</span
                >
                <span class="text-xs font-mono text-text-primary">{{
                  formatSize(result.data.size)
                }}</span>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                class="btn btn-secondary flex-1 text-[10px] font-bold uppercase tracking-widest"
                @click="close"
              >
                Close
              </button>
              <button
                class="btn btn-primary flex-1 text-[10px] font-bold uppercase tracking-widest"
                @click="navigateTo(`/torrents/${result.data.infoHash}`)"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';

interface TorrentResult {
  success: boolean;
  message: string;
  data: {
    id: string;
    infoHash: string;
    name: string;
    size: number;
    magnetLink: string;
  };
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  uploaded: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const selectedFile = ref<File | null>(null);
const selectedCategoryId = ref('');
const description = ref('');
const isPreview = ref(false);
const isUploading = ref(false);
const result = ref<TorrentResult | null>(null);
const error = ref<string | null>(null);
const copied = ref(false);

const { data: categories } = await useFetch('/api/categories');

const renderedDescription = computed(() => {
  return marked.parse(description.value || '');
});

function close() {
  emit('close');
  // Reset state after animation
  setTimeout(reset, 200);
}

function reset() {
  selectedFile.value = null;
  selectedCategoryId.value = '';
  description.value = '';
  isPreview.value = false;
  result.value = null;
  error.value = null;
  copied.value = false;
}

function insertMarkdown(type: string) {
  if (!textareaRef.value) return;

  const start = textareaRef.value.selectionStart;
  const end = textareaRef.value.selectionEnd;
  const text = description.value;
  const selected = text.substring(start, end);

  let before = '';
  let after = '';
  let placeholder = '';

  switch (type) {
    case 'bold':
      before = '**';
      after = '**';
      placeholder = 'bold text';
      break;
    case 'italic':
      before = '*';
      after = '*';
      placeholder = 'italic text';
      break;
    case 'link':
      before = '[';
      after = '](url)';
      placeholder = 'link text';
      break;
    case 'image':
      before = '![';
      after = '](url)';
      placeholder = 'alt text';
      break;
    case 'list':
      before = '\n- ';
      after = '';
      placeholder = 'list item';
      break;
    case 'quote':
      before = '\n> ';
      after = '';
      placeholder = 'quote';
      break;
    case 'code':
      before = '`';
      after = '`';
      placeholder = 'code';
      break;
  }

  const content = selected || placeholder;
  description.value =
    text.substring(0, start) + before + content + after + text.substring(end);

  // Focus back and select
  nextTick(() => {
    if (!textareaRef.value) return;
    textareaRef.value.focus();
    const newStart = start + before.length;
    const newEnd = newStart + content.length;
    textareaRef.value.setSelectionRange(newStart, newEnd);
  });
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.name.endsWith('.torrent')) {
    selectedFile.value = file;
    error.value = null;
  } else {
    error.value = 'Please select a .torrent file';
  }
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file && file.name.endsWith('.torrent')) {
    selectedFile.value = file;
    error.value = null;
  } else {
    error.value = 'Please drop a .torrent file';
  }
}

async function upload() {
  if (!selectedFile.value) return;

  isUploading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('torrent', selectedFile.value);
    if (selectedCategoryId.value) {
      formData.append('categoryId', selectedCategoryId.value);
    }
    if (description.value) {
      formData.append('description', description.value);
    }

    const response = await $fetch<TorrentResult>('/api/torrents', {
      method: 'POST',
      body: formData,
    });

    result.value = response;
    emit('uploaded');
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }; message?: string };
    error.value =
      fetchError.data?.message || fetchError.message || 'Upload failed';
  } finally {
    isUploading.value = false;
  }
}

async function copyMagnet() {
  if (!result.value?.data.magnetLink) return;

  try {
    await navigator.clipboard.writeText(result.value.data.magnetLink);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    error.value = 'Failed to copy to clipboard';
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>

<style scoped>
.toolbar-btn {
  @apply w-7 h-7 flex items-center justify-center rounded-sm text-text-muted hover:text-white hover:bg-white/5 transition-all;
}

.toolbar-btn :deep(svg) {
  @apply w-3.5 h-3.5;
}

.description-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.description-preview :deep(p) {
  margin-bottom: 0.75rem;
}

.description-preview :deep(p:last-child) {
  margin-bottom: 0;
}

.description-preview :deep(a) {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.description-preview :deep(ul),
.description-preview :deep(ol) {
  margin-bottom: 0.75rem;
  padding-left: 1.25rem;
}

.description-preview :deep(li) {
  margin-bottom: 0.25rem;
}
</style>
