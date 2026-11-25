<template>
  <div class="space-y-4">
    <div v-if="message" class="text-xs px-3 py-2 rounded border" :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'">
      {{ message.text }}
    </div>

    <div v-if="!data?.accounts.length" class="card">
      <div class="card-body text-sm text-text-muted">{{ t('safeguards.mod.empty') }}</div>
    </div>

    <div v-for="account in data?.accounts ?? []" :key="account.id" class="card">
      <div class="card-header flex flex-wrap items-center justify-between gap-2">
        <NuxtLink :to="`/users/${account.id}`" class="text-sm font-medium text-text-primary hover:underline">
          {{ account.username }}
        </NuxtLink>
        <span class="text-xs text-text-muted">
          {{ t('safeguards.mod.joined', { date: formatDate(account.createdAt) }) }}
        </span>
      </div>
      <div class="card-body space-y-3 text-sm">
        <p class="text-xs text-text-muted">
          {{ t('safeguards.mod.sharedWith') }}
          <template v-if="account.sharedWith.length">
            <span v-for="(other, i) in account.sharedWith" :key="other.id">
              <NuxtLink :to="`/users/${other.id}`" class="text-text-primary hover:underline" :class="other.isBanned && 'line-through'">{{ other.username }}</NuxtLink><span v-if="i < account.sharedWith.length - 1">, </span>
            </span>
          </template>
          <span v-else>{{ t('safeguards.mod.nobodyNow') }}</span>
        </p>

        <div v-if="account.appeal" class="p-3 rounded border border-border bg-bg-tertiary space-y-1">
          <p class="text-xs text-text-muted">
            {{ t(`safeguards.appeal.status.${account.appeal.status}`) }} · {{ formatDate(account.appeal.createdAt) }}
          </p>
          <p class="whitespace-pre-wrap break-words text-text-primary">{{ account.appeal.message }}</p>
        </div>
        <p v-else class="text-xs text-text-muted">{{ t('safeguards.mod.noAppeal') }}</p>

        <input
          v-model="notes[account.id]"
          type="text"
          maxlength="500"
          :placeholder="t('safeguards.mod.notePlaceholder')"
          class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-text-primary"
        />
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary text-xs" :disabled="busy" @click="decide(account.id, 'approve')">
            <Icon name="ph:check" aria-hidden="true" />{{ t('safeguards.mod.approve') }}
          </button>
          <button
            type="button"
            class="btn text-xs"
            :disabled="busy || account.appeal?.status !== 'pending'"
            @click="decide(account.id, 'reject')"
          >
            <Icon name="ph:x" aria-hidden="true" />{{ t('safeguards.mod.reject') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface HeldAccount {
  id: string;
  username: string;
  createdAt: string;
  lastSeen: string;
  appeal: { message: string; status: 'pending' | 'approved' | 'rejected'; staffNote: string | null; createdAt: string } | null;
  sharedWith: Array<{ id: string; username: string; isBanned: boolean }>;
}

const { t, locale } = useI18n();
const { data, refresh } = await useFetch<{ accounts: HeldAccount[] }>('/api/mod/appeals');
const notes = reactive<Record<string, string>>({});
const busy = ref(false);
const message = ref<{ ok: boolean; text: string } | null>(null);

async function decide(userId: string, decision: 'approve' | 'reject') {
  busy.value = true;
  message.value = null;
  try {
    await $fetch(`/api/mod/appeals/${userId}`, {
      method: 'POST',
      body: { decision, note: notes[userId]?.trim() || undefined },
    });
    message.value = { ok: true, text: t(decision === 'approve' ? 'safeguards.mod.approved' : 'safeguards.mod.rejected') };
    await refresh();
  } catch (err) {
    message.value = { ok: false, text: (err as { data?: { message?: string } }).data?.message ?? t('safeguards.error') };
  } finally {
    busy.value = false;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>
