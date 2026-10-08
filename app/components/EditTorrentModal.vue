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
            <Icon name="ph:pencil-simple-bold" class="text-text-muted" />
            <h3
              class="text-xs font-bold uppercase tracking-widest text-text-primary"
            >
              {{ t('edit.title') }}
            </h3>
          </div>
          <button
            class="text-text-muted hover:text-white transition-colors"
            :aria-label="t('common.close')"
            @click="close"
          >
            <Icon name="ph:x-bold" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6">
          <!-- Torrent Name -->
          <div class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1"
              >{{ t('edit.torrentName') }}</label
            >
            <input
              v-model="name"
              type="text"
              maxlength="255"
              class="input w-full !py-2 text-xs font-medium"
            />
          </div>

          <MediaIdsFields v-model="mediaIds" />

          <!-- Category Select -->
          <div class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1"
              >{{ t('common.category') }}</label
            >
            <select
              v-model="selectedCategoryId"
              class="input w-full !py-2 text-xs font-bold uppercase tracking-wider"
            >
              <option value="">{{ t('edit.noCategory') }}</option>
              <option
                v-for="cat in getFlattenedCategories(categories || [])"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <div class="flex items-center justify-between ml-1">
              <label
                class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
                >{{ t('markdown.descriptionLabel') }}</label
              >
              <button
                type="button"
                class="text-[10px] font-bold uppercase tracking-widest transition-colors"
                :class="
                  isPreview ? 'text-white' : 'text-text-muted hover:text-white'
                "
                @click="isPreview = !isPreview"
              >
                {{ isPreview ? t('common.edit') : t('markdown.preview') }}
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
                  :title="t('markdown.bold')"
                  @click="insertMarkdown('bold')"
                >
                  <Icon name="ph:text-b-bold" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.italic')"
                  @click="insertMarkdown('italic')"
                >
                  <Icon name="ph:text-italic-bold" />
                </button>
                <div class="w-px h-3 bg-border mx-1"></div>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.link')"
                  @click="insertMarkdown('link')"
                >
                  <Icon name="ph:link-bold" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.image')"
                  @click="insertMarkdown('image')"
                >
                  <Icon name="ph:image-bold" />
                </button>
                <div class="w-px h-3 bg-border mx-1"></div>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.list')"
                  @click="insertMarkdown('list')"
                >
                  <Icon name="ph:list-bullets-bold" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.quote')"
                  @click="insertMarkdown('quote')"
                >
                  <Icon name="ph:quotes-bold" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  :title="t('markdown.code')"
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
                :placeholder="t('markdown.descriptionPlaceholder')"
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
                {{ t('markdown.nothingToPreview') }}
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="error"
            class="bg-error/10 border border-error/20 rounded p-3 flex items-start gap-2"
          >
            <Icon
              name="ph:warning-circle-fill"
              class="text-error text-lg shrink-0 mt-0.5"
            />
            <p class="text-xs text-error">{{ error }}</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              class="btn btn-secondary flex-1 text-[10px] font-bold uppercase tracking-widest"
              :disabled="isSaving"
              @click="close"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="btn btn-primary flex-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              :disabled="isSaving"
              @click="save"
            >
              <Icon
                v-if="isSaving"
                name="ph:circle-notch"
                class="animate-spin"
              />
              <span>{{ isSaving ? t('common.saving') : t('common.saveChanges') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { t } = useI18n();

interface Category {
  id: string;
  name: string;
  subcategories?: Category[];
}

interface TorrentData {
  infoHash: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  imdbId: string | null;
  tmdbId: number | null;
  tvdbId: number | null;
}

const props = defineProps<{
  isOpen: boolean;
  torrent: TorrentData;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const selectedCategoryId = ref('');
const name = ref('');
const mediaIds = ref({ imdbId: '', tmdbId: '', tvdbId: '' });

function loadForm(torrent: TorrentData) {
  selectedCategoryId.value = torrent.categoryId || '';
  description.value = torrent.description || '';
  name.value = torrent.name;
  mediaIds.value = {
    imdbId: torrent.imdbId ?? '',
    tmdbId: torrent.tmdbId?.toString() ?? '',
    tvdbId: torrent.tvdbId?.toString() ?? '',
  };
}
const description = ref('');
const isPreview = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);

const { data: categories } = await useFetch<Category[]>('/api/categories');

const renderedDescription = computed(() => {
  return renderMarkdown(description.value);
});

// Initialize form data when torrent prop changes
watch(
  () => props.torrent,
  (torrent) => {
    if (torrent) loadForm(torrent);
  },
  { immediate: true }
);

// Reset form when modal opens
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && props.torrent) {
      loadForm(props.torrent);
      isPreview.value = false;
      error.value = null;
    }
  }
);

function getFlattenedCategories(
  categories: Category[],
  prefix = ''
): Array<{ id: string; name: string }> {
  let result: Array<{ id: string; name: string }> = [];

  for (const category of categories) {
    result.push({ id: category.id, name: prefix + category.name });

    if (category.subcategories) {
      result = result.concat(
        getFlattenedCategories(category.subcategories, prefix + '╚=> ')
      );
    }
  }

  return result;
}

function close() {
  emit('close');
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
      placeholder = t('markdown.placeholders.bold');
      break;
    case 'italic':
      before = '*';
      after = '*';
      placeholder = t('markdown.placeholders.italic');
      break;
    case 'link':
      before = '[';
      after = '](url)';
      placeholder = t('markdown.placeholders.link');
      break;
    case 'image':
      before = '![';
      after = '](url)';
      placeholder = t('markdown.placeholders.image');
      break;
    case 'list':
      before = '\n- ';
      after = '';
      placeholder = t('markdown.placeholders.list');
      break;
    case 'quote':
      before = '\n> ';
      after = '';
      placeholder = t('markdown.placeholders.quote');
      break;
    case 'code':
      before = '`';
      after = '`';
      placeholder = t('markdown.placeholders.code');
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

async function save() {
  isSaving.value = true;
  error.value = null;

  try {
    await fetch(`/api/torrents/${props.torrent.infoHash}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.value.trim() || undefined,
        description: description.value,
        categoryId: selectedCategoryId.value || null,
        ...mediaIds.value,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('edit.saveFailed'));
      }
      return res.json();
    });

    emit('saved');
    close();
  } catch (err: unknown) {
    const fetchError = err as { message?: string };
    error.value = fetchError.message || t('edit.saveFailed');
  } finally {
    isSaving.value = false;
  }
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
