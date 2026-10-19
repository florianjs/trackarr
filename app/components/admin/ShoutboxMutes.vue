<template>
  <div class="card">
    <div class="card-header">
      <h3 class="text-sm font-medium text-text-primary">{{ t('shoutbox.mutes.title') }}</h3>
    </div>
    <div class="card-body space-y-3">
      <p class="text-xs text-text-muted">{{ t('shoutbox.mutes.hint') }}</p>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <table v-if="mutes.length" class="data-table">
        <thead>
          <tr>
            <th>{{ t('shoutbox.mutes.member') }}</th>
            <th>{{ t('shoutbox.mutes.until') }}</th>
            <th class="hidden md:table-cell">{{ t('shoutbox.mutes.reason') }}</th>
            <th class="hidden sm:table-cell">{{ t('shoutbox.mutes.by') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in mutes" :key="m.userId">
            <td>
              <NuxtLink :to="`/users/${m.userId}`" class="text-sm hover:underline underline-offset-2">{{ m.username }}</NuxtLink>
            </td>
            <td class="num text-xs text-text-secondary whitespace-nowrap">{{ formatFull(m.until) }}</td>
            <td class="text-xs text-text-muted hidden md:table-cell">{{ m.reason || '—' }}</td>
            <td class="text-xs text-text-muted hidden sm:table-cell">{{ m.mutedBy || '—' }}</td>
            <td class="text-right">
              <button class="btn btn-secondary !py-1 !px-2 text-xs" @click="unmute(m.userId)">{{ t('shoutbox.mutes.unmute') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- A failed load must not read as "nobody is muted" -->
      <p v-else-if="loadError" class="text-sm text-danger" role="alert">
        {{ loadError.data?.message ?? t('shoutbox.error') }}
      </p>
      <p v-else class="text-sm text-text-muted">{{ t('shoutbox.mutes.empty') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Mute {
  userId: string;
  username: string;
  until: string;
  reason: string | null;
  mutedBy: string | null;
}

const { t, locale } = useI18n();
const {
  data: mutes,
  error: loadError,
  refresh,
} = await useFetch<Mute[]>('/api/mod/shoutbox/mutes', { default: () => [] });
const error = ref('');

async function unmute(userId: string) {
  error.value = '';
  try {
    await $fetch(`/api/mod/shoutbox/mutes/${userId}`, { method: 'DELETE' });
    await refresh();
  } catch (err) {
    error.value = (err as { data?: { message?: string } }).data?.message ?? t('shoutbox.error');
  }
}

const formatFull = (iso: string) =>
  new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' });
</script>
