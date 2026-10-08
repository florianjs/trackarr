<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:prohibit" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ t('admin.torznabBlacklist.title') }}
          </h3>
        </div>
        <button
          @click="() => refresh()"
          :disabled="loading"
          class="p-1.5 bg-bg-tertiary border border-border rounded hover:border-white/20 transition-colors"
          :title="t('common.refresh')"
        >
          <Icon
            name="ph:arrows-clockwise"
            :class="['text-text-muted text-sm', loading && 'animate-spin']"
          />
        </button>
      </div>
    </div>
    <div class="card-body">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- IP Blacklist -->
        <div>
          <h4
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
          >
            {{ t('admin.torznabBlacklist.rateLimitedIps') }}
          </h4>
          <div v-if="loading" class="space-y-2">
            <div
              v-for="i in 3"
              :key="i"
              class="h-10 bg-bg-tertiary rounded animate-pulse"
            ></div>
          </div>
          <div
            v-else-if="data?.ipBlacklist.length === 0"
            class="text-sm text-text-muted py-4 text-center bg-bg-tertiary rounded-lg"
          >
            {{ t('admin.torznabBlacklist.noIps') }}
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="entry in data?.ipBlacklist"
              :key="entry.ip"
              class="flex items-center justify-between p-3 bg-bg-tertiary border border-border rounded-lg"
            >
              <div>
                <code class="text-xs font-mono text-text-primary">{{
                  entry.ip
                }}</code>
                <p class="text-[10px] text-text-muted mt-0.5">
                  {{ entry.reason }}
                </p>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-text-muted">{{
                  t('admin.torznabBlacklist.expiresIn')
                }}</span>
                <p class="text-xs font-mono text-yellow-400">
                  {{ formatTimeRemaining(entry.expiresAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Blocked Users -->
        <div>
          <h4
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
          >
            {{ t('admin.torznabBlacklist.blockedUsers') }}
          </h4>
          <div v-if="loading" class="space-y-2">
            <div
              v-for="i in 3"
              :key="i"
              class="h-10 bg-bg-tertiary rounded animate-pulse"
            ></div>
          </div>
          <div
            v-else-if="data?.blockedUsers.length === 0"
            class="text-sm text-text-muted py-4 text-center bg-bg-tertiary rounded-lg"
          >
            {{ t('admin.torznabBlacklist.noUsers') }}
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="user in data?.blockedUsers"
              :key="user.blockId"
              class="flex items-center justify-between p-3 bg-bg-tertiary border border-border rounded-lg"
            >
              <div>
                <code class="text-xs font-mono text-text-primary">{{
                  user.passkey
                }}</code>
                <p class="text-[10px] text-text-muted mt-0.5">
                  {{ user.reason }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-text-muted">
                  {{ formatRelativeTime(user.blockedAt) }}
                </span>
                <button
                  @click="unblockUser(user.blockId)"
                  :disabled="unblocking === user.blockId"
                  class="px-2 py-1 bg-bg-secondary border border-border rounded text-[10px] hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  {{
                    unblocking === user.blockId
                      ? t('admin.torznabBlacklist.unblocking')
                      : t('admin.torznabBlacklist.unblock')
                  }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

interface BlacklistEntry {
  ip: string;
  reason: string;
  expiresAt: number;
  violations: number;
}

interface BlockedUser {
  blockId: string;
  passkey: string;
  reason: string;
  blockedAt: number;
}

interface BlacklistData {
  ipBlacklist: BlacklistEntry[];
  blockedUsers: BlockedUser[];
}

const {
  data,
  pending: loading,
  refresh,
} = await useFetch<BlacklistData>('/api/admin/torznab/blacklist');

const unblocking = ref<string | null>(null);

async function unblockUser(blockId: string) {
  unblocking.value = blockId;
  try {
    await fetch('/api/admin/torznab/unblock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId }),
    });
    await refresh();
  } catch (error) {
    console.error('Failed to unblock user:', error);
  } finally {
    unblocking.value = null;
  }
}

function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining < 0) return t('admin.torznabBlacklist.expired');

  const seconds = Math.floor(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return t('admin.torznabBlacklist.justNow');
  if (seconds < 3600)
    return t('admin.torznabBlacklist.minutesAgo', { n: Math.floor(seconds / 60) });
  if (seconds < 86400)
    return t('admin.torznabBlacklist.hoursAgo', { n: Math.floor(seconds / 3600) });
  return t('admin.torznabBlacklist.daysAgo', { n: Math.floor(seconds / 86400) });
}
</script>
