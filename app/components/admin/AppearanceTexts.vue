<template>
  <div>
    <p class="text-sm text-text-muted mb-4">{{ t('appearance.texts.hint') }}</p>

    <div class="flex flex-wrap items-center gap-2 mb-4">
      <select v-model="locale" class="input w-auto" :aria-label="t('appearance.texts.locale')">
        <option v-for="code in APPEARANCE_LOCALES" :key="code" :value="code">
          {{ localeName(code) }}{{ count(code) ? ` (${count(code)})` : '' }}
        </option>
      </select>
      <div class="relative flex-1 min-w-[12rem]">
        <Icon name="ph:magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input v-model="query" type="search" class="input w-full pl-8" :placeholder="t('appearance.texts.search')" />
      </div>
      <label class="flex items-center gap-2 text-sm text-text-secondary select-none cursor-pointer">
        <input v-model="onlyModified" type="checkbox" class="accent-free" />
        {{ t('appearance.texts.onlyModified') }}
      </label>
    </div>

    <div v-if="pending" class="py-10 text-center text-text-muted"><Icon name="ph:circle-notch" class="animate-spin" /></div>
    <template v-else>
      <p class="text-xs text-text-muted mb-2">{{ t('appearance.texts.results', { n: filtered.length }, filtered.length) }}</p>
      <ul class="divide-y divide-border border border-border rounded">
        <li v-for="key in page" :key="key" class="p-3 grid md:grid-cols-2 gap-2">
          <div class="min-w-0">
            <code class="num text-2xs text-text-muted break-all">{{ key }}</code>
            <p class="text-sm text-text-secondary mt-0.5 break-words">{{ source[key] }}</p>
          </div>
          <div class="flex items-start gap-1">
            <textarea
              :value="overrides[key] ?? ''"
              rows="1"
              class="input w-full resize-y min-h-[2.25rem]"
              :class="{ 'border-free/60': overrides[key] !== undefined }"
              :placeholder="source[key]"
              :maxlength="MAX_TEXT_OVERRIDE_LENGTH"
              :aria-label="key"
              @input="setText(key, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
            <button
              v-if="overrides[key] !== undefined"
              type="button"
              class="p-2 text-text-muted hover:text-text-primary"
              :title="t('common.reset')"
              :aria-label="t('common.reset')"
              @click="setText(key, '')"
            >
              <Icon name="ph:arrow-counter-clockwise" class="block" />
            </button>
          </div>
        </li>
        <li v-if="!filtered.length" class="p-6 text-center text-sm text-text-muted">{{ t('appearance.texts.empty') }}</li>
      </ul>
      <div v-if="pages > 1" class="flex items-center justify-center gap-2 mt-3">
        <button type="button" class="btn btn-ghost" :disabled="pageIndex === 0" @click="pageIndex--">
          <Icon name="ph:caret-left" />
        </button>
        <span class="text-xs text-text-muted num">{{ t('common.pageOf', { page: pageIndex + 1, pages }) }}</span>
        <button type="button" class="btn btn-ghost" :disabled="pageIndex >= pages - 1" @click="pageIndex++">
          <Icon name="ph:caret-right" />
        </button>
      </div>
      <p class="text-xs text-text-muted mt-3">{{ t('appearance.texts.placeholders') }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { APPEARANCE_LOCALES, MAX_TEXT_OVERRIDE_LENGTH, type Appearance } from '~~/shared/utils/appearance';

type Locale = (typeof APPEARANCE_LOCALES)[number];
const PAGE_SIZE = 40;

const model = defineModel<Appearance>({ required: true });
const { t, locale: uiLocale, locales } = useI18n();

const locale = ref<Locale>(
  (APPEARANCE_LOCALES as readonly string[]).includes(uiLocale.value) ? (uiLocale.value as Locale) : 'en'
);
const query = ref('');
const onlyModified = ref(false);
const pageIndex = ref(0);

const { data, pending } = await useFetch<Record<string, string>>('/api/admin/appearance/texts', {
  query: { locale },
  lazy: true,
});
const source = computed(() => data.value ?? {});
const overrides = computed(() => model.value.texts[locale.value] ?? {});

function localeName(code: string) {
  return locales.value.find((l) => l.code === code)?.name ?? code;
}
const count = (code: Locale) => Object.keys(model.value.texts[code] ?? {}).length;

// Matches the key, the shipped text or the override
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return Object.keys(source.value).filter((key) => {
    if (onlyModified.value && overrides.value[key] === undefined) return false;
    if (!q) return true;
    return [key, source.value[key], overrides.value[key] ?? ''].some((s) => s!.toLowerCase().includes(q));
  });
});
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const page = computed(() => filtered.value.slice(pageIndex.value * PAGE_SIZE, (pageIndex.value + 1) * PAGE_SIZE));
watch([query, onlyModified, locale], () => (pageIndex.value = 0));
// Resetting the last text of the last page shrinks the list
watch(pages, (count) => (pageIndex.value = Math.min(pageIndex.value, count - 1)));

// An empty field restores the shipped text
function setText(key: string, value: string) {
  const current = { ...overrides.value };
  if (value === '') delete current[key];
  else current[key] = value;
  const texts = { ...model.value.texts };
  if (Object.keys(current).length) texts[locale.value] = current;
  else delete texts[locale.value];
  model.value = { ...model.value, texts };
}
</script>
