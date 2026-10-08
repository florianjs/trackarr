<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:gift-bold" class="text-text-muted" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
          {{ t('freeleech.admin.title') }}
        </h3>
      </div>
      <span
        class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
        :class="state?.active ? 'bg-success/20 text-success' : 'bg-bg-tertiary text-text-muted'"
      >
        {{ statusLabel }}
      </span>
    </div>
    <div class="card-body space-y-4">
      <p class="text-xs text-text-muted">{{ t('freeleech.admin.description') }}</p>

      <div class="flex flex-wrap items-end gap-3">
        <label class="space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {{ t('freeleech.admin.duration') }}
          </span>
          <input
            v-model.number="durationHours"
            type="number"
            min="1"
            step="1"
            class="input w-40 !py-2 text-xs font-mono"
            placeholder="∞"
          />
        </label>
        <button class="btn btn-primary !py-2 text-xs" :disabled="saving" @click="save(true)">
          {{ state?.active ? t('freeleech.admin.update') : t('freeleech.admin.start') }}
        </button>
        <button
          v-if="state?.active"
          class="btn btn-secondary !py-2 text-xs"
          :disabled="saving"
          @click="stop"
        >
          {{ t('freeleech.admin.stop') }}
        </button>
      </div>
      <p class="text-[10px] text-text-muted">{{ t('freeleech.admin.durationHint') }}</p>
      <p v-if="error" class="text-xs text-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FreeleechAdminState {
  enabled: boolean;
  until: string | null;
  active: boolean;
}

const { t, locale } = useI18n();

const { data: state } = await useFetch<FreeleechAdminState>('/api/admin/freeleech');
const durationHours = ref<number | ''>(24);
const saving = ref(false);
const error = ref<string | null>(null);

const statusLabel = computed(() => {
  if (!state.value?.active) return t('freeleech.admin.inactive');
  if (!state.value.until) return t('freeleech.admin.activeForever');
  return t('freeleech.admin.activeUntil', {
    date: new Date(state.value.until).toLocaleString(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  });
});

async function save(enabled: boolean) {
  saving.value = true;
  error.value = null;
  try {
    state.value = await $fetch<FreeleechAdminState>('/api/admin/freeleech', {
      method: 'PUT',
      body: {
        enabled,
        // Only an empty field means "no end date": 0 is sent as is and refused
        durationHours:
          enabled && durationHours.value !== '' ? Number(durationHours.value) : null,
      },
    });
  } catch (err) {
    error.value = (err as { data?: { message?: string } }).data?.message ?? 'Error';
  } finally {
    saving.value = false;
  }
}

function stop() {
  if (!confirm(t('freeleech.admin.confirmStop'))) return;
  return save(false);
}
</script>
