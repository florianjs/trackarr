<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:shield-warning" class="text-text-muted" />
        <h3 class="text-sm font-medium text-text-primary">{{ t('safeguards.admin.title') }}</h3>
      </div>
    </div>
    <div v-if="form" class="card-body space-y-5">
      <div v-if="message" class="text-xs px-3 py-2 rounded border" :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'">
        {{ message.text }}
      </div>

      <!-- Slur filter -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm text-text-primary">
          <input v-model="form.slurFilter" type="checkbox" :disabled="saving" @change="save({ slurFilter: form.slurFilter })" />
          {{ t('safeguards.admin.slurFilter') }}
        </label>
        <p class="text-xs text-text-muted">{{ t('safeguards.admin.slurFilterHint') }}</p>
        <label class="block">
          <span class="block text-xs text-text-muted mb-1">{{ t('safeguards.admin.slurWords') }}</span>
          <textarea
            v-model="form.slurWords"
            rows="3"
            spellcheck="false"
            :disabled="saving || !form.slurFilter"
            :placeholder="t('safeguards.admin.slurWordsPlaceholder')"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-xs font-mono text-text-primary disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          class="btn text-xs"
          :disabled="saving || !form.slurFilter"
          @click="save({ slurWords: form.slurWords })"
        >
          {{ t('safeguards.admin.saveWords') }}
        </button>
      </div>

      <!-- Multi-account guard -->
      <div class="space-y-2 pt-4 border-t border-border">
        <label class="flex items-center gap-2 text-sm text-text-primary">
          <input
            v-model="form.multiAccountGuard"
            type="checkbox"
            :disabled="saving"
            @change="save({ multiAccountGuard: form.multiAccountGuard })"
          />
          {{ t('safeguards.admin.multiAccount') }}
        </label>
        <p class="text-xs text-text-muted">{{ t('safeguards.admin.multiAccountHint') }}</p>
        <NuxtLink to="/mod/appeals" class="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary underline underline-offset-2">
          {{ t('safeguards.admin.openAppeals') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Safeguards {
  slurFilter: boolean;
  slurWords: string;
  multiAccountGuard: boolean;
}

const { t } = useI18n();
const { data: form } = await useFetch<Safeguards>('/api/admin/safeguards');
const saving = ref(false);
const message = ref<{ ok: boolean; text: string } | null>(null);

async function save(patch: Partial<Safeguards>) {
  saving.value = true;
  message.value = null;
  try {
    form.value = await $fetch<Safeguards>('/api/admin/safeguards', { method: 'PUT', body: patch });
    message.value = { ok: true, text: t('safeguards.admin.saved') };
  } catch (err) {
    message.value = { ok: false, text: (err as { data?: { message?: string } }).data?.message ?? t('safeguards.error') };
    // Checkboxes already flipped: reload what is saved
    form.value = await $fetch<Safeguards>('/api/admin/safeguards').catch(() => form.value);
  } finally {
    saving.value = false;
  }
}
</script>
