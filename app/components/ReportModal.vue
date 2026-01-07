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
                class="text-xs font-bold uppercase tracking-wider text-text-primary"
              >
                Report {{ targetType }}
              </h3>
            </div>
            <button
              @click="close"
              class="text-text-muted hover:text-text-primary"
            >
              <Icon name="ph:x-bold" />
            </button>
          </div>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block"
            >
              Reason
            </label>
            <select v-model="reason" class="input w-full">
              <option value="">Select a reason...</option>
              <option value="Spam or advertising">Spam or advertising</option>
              <option value="Fake or misleading content">
                Fake or misleading content
              </option>
              <option value="Copyright violation">Copyright violation</option>
              <option value="Inappropriate content">
                Inappropriate content
              </option>
              <option value="Harassment or abuse">Harassment or abuse</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block"
            >
              Additional Details (optional)
            </label>
            <textarea
              v-model="details"
              rows="3"
              class="input w-full resize-none"
              placeholder="Provide any additional context..."
            ></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="close" class="btn btn-secondary">Cancel</button>
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
              Submit Report
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
    notifications.success('Report submitted successfully');
    emit('submitted');
    close();
  } catch (error: any) {
    notifications.error(error.data?.message || 'Failed to submit report');
  } finally {
    isSubmitting.value = false;
  }
}
</script>
