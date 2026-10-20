<template>
  <div class="space-y-6">
    <div class="card">
      <div class="card-header flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-1 flex-wrap" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="current === tab.id"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded"
            :class="current === tab.id ? 'bg-bg-tertiary text-text-primary font-medium' : 'text-text-muted hover:text-text-primary'"
            @click="current = tab.id"
          >
            <Icon :name="tab.icon" />{{ t(`appearance.tabs.${tab.id}`) }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="dirty" class="text-xs text-leech">{{ t('appearance.unsaved') }}</span>
          <button type="button" class="btn btn-secondary" :disabled="!dirty || saving" @click="discard">
            {{ t('appearance.discard') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="!dirty || saving" @click="save">
            <Icon :name="saving ? 'ph:circle-notch' : 'ph:floppy-disk'" :class="{ 'animate-spin': saving }" />
            {{ t('common.save') }}
          </button>
        </div>
      </div>
      <!-- Locked while saving: the response replaces the draft -->
      <div class="card-body transition-opacity" :class="{ 'opacity-60': saving }" role="tabpanel" :inert="saving">
        <p class="text-xs text-text-muted mb-4">{{ t('appearance.previewHint') }}</p>
        <AdminAppearanceTheme v-if="current === 'theme'" v-model="draft" />
        <AdminAppearanceTypography v-else-if="current === 'typography'" v-model="draft" />
        <AdminAppearanceImages v-else-if="current === 'images'" :appearance="saved" @uploaded="onImage" />
        <AdminAppearanceLogin v-else-if="current === 'login'" v-model="draft" />
        <AdminAppearanceTexts v-else v-model="draft" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';
import type { Appearance } from '~~/shared/utils/appearance';

const { t } = useI18n();
const notifications = useNotificationStore();
const appearance = useAppearance();

const tabs = [
  { id: 'theme', icon: 'ph:palette' },
  { id: 'typography', icon: 'ph:text-aa' },
  { id: 'images', icon: 'ph:image' },
  { id: 'login', icon: 'ph:sign-in' },
  { id: 'texts', icon: 'ph:translate' },
] as const;
const current = ref<(typeof tabs)[number]['id']>('theme');

// What the server holds, and the edited copy previewed on the whole site
const saved = ref<Appearance>(structuredClone(toRaw(appearance.value)));
const draft = ref<Appearance>(structuredClone(toRaw(appearance.value)));
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(saved.value));

watch(draft, (value) => (appearance.value = structuredClone(toRaw(value))), { deep: true });

// Leaving without saving drops the preview
onBeforeUnmount(() => {
  appearance.value = structuredClone(toRaw(saved.value));
});

function discard() {
  draft.value = structuredClone(toRaw(saved.value));
}

const saving = ref(false);
async function save() {
  saving.value = true;
  const textsChanged = JSON.stringify(draft.value.texts) !== JSON.stringify(saved.value.texts);
  try {
    const result = await $fetch<Appearance>('/api/admin/appearance', { method: 'PUT', body: draft.value });
    saved.value = result;
    draft.value = structuredClone(result);
    notifications.success(t('appearance.saved'));
    // Removed text overrides stay merged in vue-i18n until the app reloads
    if (textsChanged) reloadNuxtApp({ force: true });
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message;
    notifications.error(t('appearance.saveFailed'), message);
  } finally {
    saving.value = false;
  }
}

// Images are stored on upload: update both copies, keep other edits pending
function onImage(next: Appearance) {
  saved.value = { ...saved.value, login: { ...saved.value.login, image: next.login.image }, images: next.images };
  draft.value = { ...draft.value, login: { ...draft.value.login, image: next.login.image }, images: next.images };
}
</script>
