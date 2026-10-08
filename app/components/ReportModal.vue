<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="card w-full max-w-md">
        <div class="card-header">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="ph:flag-bold" class="text-error" />
              <h3
                class="text-sm font-medium text-text-primary"
              >
                {{
                  t('report.title', {
                    type: t(`report.targetTypes.${targetType}`),
                  })
                }}
              </h3>
            </div>
            <button
              @click="close"
              class="text-text-muted hover:text-text-primary"
              :aria-label="t('common.close')"
            >
              <Icon name="ph:x-bold" />
            </button>
          </div>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label
              class="text-xs font-bold text-text-muted mb-2 block"
            >
              {{ t('common.reason') }}
            </label>
            <select v-model="reason" class="input w-full">
              <option value="">{{ t('report.selectReason') }}</option>
              <option value="Spam or advertising">
                {{ t('report.reasons.spam') }}
              </option>
              <option value="Fake or misleading content">
                {{ t('report.reasons.fake') }}
              </option>
              <option value="Copyright violation">
                {{ t('report.reasons.copyright') }}
              </option>
              <option value="Inappropriate content">
                {{ t('report.reasons.inappropriate') }}
              </option>
              <option value="Harassment or abuse">
                {{ t('report.reasons.harassment') }}
              </option>
              <option value="Other">{{ t('report.reasons.other') }}</option>
            </select>
          </div>
          <div>
            <label
              class="text-xs font-bold text-text-muted mb-2 block"
            >
              {{ t('report.details') }} ({{ t('common.optional') }})
            </label>
            <textarea
              v-model="details"
              rows="3"
              class="input w-full resize-none"
              :placeholder="t('report.detailsPlaceholder')"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="close" class="btn btn-secondary">
              {{ t('common.cancel') }}
            </button>
            <button
              @click="submitReport"
              :disabled="!reason || isSubmitting"
              class="btn btn-primary"
            >
              <Icon
                v-if="isSubmitting"
                name="ph:circle-notch"
                class="animate-spin mr-1"
              />
              {{ t('report.submit') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';

const props = defineProps<{
  isOpen: boolean;
  targetType: 'torrent' | 'user' | 'post' | 'comment';
  targetId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted'): void;
}>();

const { t } = useI18n();
const notifications = useNotificationStore();
const reason = ref('');
const details = ref('');
const isSubmitting = ref(false);

function close() {
  reason.value = '';
  details.value = '';
  emit('close');
}

async function submitReport() {
  if (!reason.value || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await $fetch('/api/reports', {
      method: 'POST',
      body: {
        targetType: props.targetType,
        targetId: props.targetId,
        reason: reason.value,
        details: details.value || undefined,
      },
    });
    notifications.success(t('report.submitted'));
    emit('submitted');
    close();
  } catch (error: any) {
    notifications.error(error.data?.message || t('report.failed'));
  } finally {
    isSubmitting.value = false;
  }
}
</script>
