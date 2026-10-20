<template>
  <div>
    <SettingsGroup
      v-for="slot in APPEARANCE_IMAGE_SLOTS"
      :key="slot"
      :label="t(`appearance.images.${slot}`)"
      :description="t(`appearance.images.${slot}Hint`)"
    >
      <div
        class="relative rounded-lg border border-dashed border-border bg-bg-tertiary/50 overflow-hidden flex items-center justify-center"
        :class="slot === 'homeBanner' ? 'h-32' : 'h-48'"
      >
        <img v-if="current(slot)" :src="current(slot)!" alt="" class="absolute inset-0 w-full h-full object-cover" />
        <span v-else class="text-sm text-text-muted flex items-center gap-2">
          <Icon name="ph:image" />{{ t('appearance.images.none') }}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-3">
        <label class="btn btn-secondary cursor-pointer" :class="{ 'opacity-50 pointer-events-none': busy === slot }">
          <Icon :name="busy === slot ? 'ph:circle-notch' : 'ph:upload-simple'" :class="{ 'animate-spin': busy === slot }" />
          {{ current(slot) ? t('appearance.images.replace') : t('appearance.images.upload') }}
          <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" @change="upload(slot, $event)" />
        </label>
        <button v-if="current(slot)" type="button" class="btn btn-ghost text-danger" :disabled="busy === slot" @click="send(slot, null)">
          <Icon name="ph:trash" />{{ t('appearance.images.remove') }}
        </button>
        <span class="text-xs text-text-muted">{{ t('appearance.images.formats') }}</span>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';
import { APPEARANCE_IMAGE_SLOTS, type Appearance, type AppearanceImageSlot } from '~~/shared/utils/appearance';

const props = defineProps<{ appearance: Appearance }>();
const emit = defineEmits<{ uploaded: [appearance: Appearance] }>();
const { t } = useI18n();
const notifications = useNotificationStore();

const current = (slot: AppearanceImageSlot) =>
  slot === 'loginImage' ? props.appearance.login.image : props.appearance.images.homeBanner;

const busy = ref<AppearanceImageSlot | null>(null);

function upload(slot: AppearanceImageSlot, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) send(slot, file);
}

// Stored right away, not with the Save button
async function send(slot: AppearanceImageSlot, file: File | null) {
  const form = new FormData();
  form.append('slot', slot);
  if (file) form.append('image', file);
  busy.value = slot;
  try {
    emit('uploaded', await $fetch<Appearance>('/api/admin/appearance/image', { method: 'POST', body: form }));
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message;
    notifications.error(t('appearance.images.failed'), message);
  } finally {
    busy.value = null;
  }
}
</script>
