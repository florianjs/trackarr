<template>
  <div v-if="bounty" class="space-y-6">
    <NuxtLink to="/bounties" class="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white inline-flex items-center gap-1">
      <Icon name="ph:arrow-left-bold" />
      {{ t('bonus.bounties.detail.back') }}
    </NuxtLink>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-xl font-bold text-text-primary tracking-tight break-words">{{ bounty.title }}</h2>
        <p class="text-[10px] text-text-muted font-mono mt-1">
          {{ t('bonus.bounties.requestedBy', { user: bounty.requester?.username ?? '?' }) }}
          <span v-if="bounty.category"> · {{ bounty.category.name }}</span>
          · {{ new Date(bounty.createdAt).toLocaleString(locale) }}
        </p>
        <a
          v-if="bounty.imdbId"
          :href="imdbUrl(bounty.imdbId)"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 mt-2 text-[10px] font-bold border border-border px-2 py-1 rounded-sm text-text-secondary uppercase tracking-wider hover:text-white"
        >
          IMDb <Icon name="ph:arrow-square-out-bold" />
        </a>
      </div>
      <div class="text-right">
        <p class="text-[10px] font-bold text-text-muted uppercase tracking-widest">{{ t('bonus.bounties.reward') }}</p>
        <p class="text-2xl font-bold text-accent font-mono">{{ points(bounty.totalPoints) }}</p>
        <p class="text-[10px] uppercase tracking-wider text-text-muted">{{ t(`bonus.bounties.status.${bounty.status}`) }}</p>
      </div>
    </div>

    <div v-if="message" class="text-xs px-3 py-2 rounded border" :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'">
      {{ message.text }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div v-if="bounty.description" class="card">
          <!-- Plain text: rendered escaped, no HTML -->
          <div class="card-body text-sm text-text-secondary whitespace-pre-line break-words">{{ bounty.description }}</div>
        </div>

        <!-- Proposed / filled torrent -->
        <div v-if="bounty.filledTorrent" class="card">
          <div class="card-body space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {{ bounty.status === 'filled' ? t('bonus.bounties.detail.filledBy', { user: bounty.filledBy?.username ?? '?' }) : t('bonus.bounties.detail.proposed') }}
            </p>
            <NuxtLink :to="`/torrents/${bounty.filledTorrent.infoHash}`" class="text-sm font-bold text-text-primary hover:underline break-all">
              {{ bounty.filledTorrent.name }}
            </NuxtLink>
            <p v-if="bounty.status === 'claimed'" class="text-[10px] text-text-muted font-mono">
              {{ t('bonus.bounties.detail.uploader', { user: bounty.filledBy?.username ?? '?' }) }}
            </p>
            <div v-if="bounty.status === 'claimed' && canReview" class="flex gap-2">
              <button class="btn btn-primary !py-1.5 text-xs" :disabled="busy" @click="act('accept', t('bonus.bounties.detail.confirmAccept'))">
                {{ t('bonus.bounties.detail.accept') }}
              </button>
              <button class="btn btn-secondary !py-1.5 text-xs" :disabled="busy" @click="act('reject')">
                {{ t('bonus.bounties.detail.reject') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Fill -->
        <div v-if="bounty.status === 'open'" class="card">
          <div class="card-body space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.bounties.detail.fill') }}</p>
            <p class="text-[10px] text-text-muted">{{ t('bonus.bounties.detail.fillHint') }}</p>
            <div class="flex gap-2">
              <input v-model="fillHash" type="text" maxlength="40" class="input w-full !py-2 text-xs font-mono" :placeholder="t('bonus.bounties.detail.fillPlaceholder')" />
              <button class="btn btn-primary !py-2 text-xs shrink-0" :disabled="busy || !/^[a-fA-F0-9]{40}$/.test(fillHash.trim())" @click="fill">
                {{ t('bonus.bounties.detail.fillSubmit') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <!-- Contribute -->
        <div v-if="bounty.status === 'open'" class="card">
          <div class="card-body space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.bounties.detail.contribute') }}</p>
            <div class="flex gap-2">
              <input v-model.number="contribution" type="number" min="1" class="input w-full !py-2 text-xs font-mono" :placeholder="t('bonus.bounties.detail.contributePlaceholder')" />
              <button class="btn btn-secondary !py-2 text-xs shrink-0" :disabled="busy || !(contribution > 0)" @click="contribute">
                <Icon name="ph:plus-bold" />
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">{{ t('bonus.bounties.detail.contributors') }}</h3>
          </div>
          <ul class="card-body space-y-2 text-xs">
            <li v-for="c in bounty.contributions" :key="c.id" class="flex justify-between gap-2">
              <span class="truncate">{{ c.user?.username ?? '?' }}</span>
              <span class="font-mono text-text-muted">{{ points(c.amount) }}</span>
            </li>
          </ul>
        </div>

        <button v-if="bounty.status === 'open' && canReview" class="btn btn-secondary w-full !py-2 text-xs" :disabled="busy" @click="act('cancel', t('bonus.bounties.detail.confirmCancel'))">
          {{ t('bonus.bounties.detail.cancelBounty') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface BountyDetail {
  id: string;
  title: string;
  description: string | null;
  imdbId: string | null;
  status: 'open' | 'claimed' | 'filled' | 'cancelled';
  totalPoints: number;
  createdAt: string;
  requesterId: string;
  requester: { id: string; username: string } | null;
  filledBy: { id: string; username: string } | null;
  filledTorrent: { id: string; infoHash: string; name: string } | null;
  category: { id: string; name: string } | null;
  contributions: { id: string; amount: number; user: { id: string; username: string } | null }[];
}

const { t, locale } = useI18n();
const route = useRoute();
const { user } = useUserSession();

const { data: bounty, refresh, error } = await useFetch<BountyDetail>(`/api/bounties/${route.params.id}`);
if (error.value || !bounty.value) {
  throw createError({ statusCode: 404, message: 'Bounty not found' });
}

useHead({ title: () => bounty.value?.title ?? t('bonus.bounties.title') });

const canReview = computed(
  () => !!user.value && (user.value.id === bounty.value?.requesterId || user.value.isAdmin || user.value.isModerator)
);

const busy = ref(false);
const message = ref<{ ok: boolean; text: string } | null>(null);
const fillHash = ref('');
const contribution = ref(0);

function points(n: number): string {
  return t('bonus.points', { n: Math.floor(n).toLocaleString(locale.value) });
}

async function run(fn: () => Promise<unknown>) {
  busy.value = true;
  message.value = null;
  try {
    await fn();
    await refresh();
  } catch (err) {
    message.value = { ok: false, text: (err as { data?: { message?: string } }).data?.message ?? 'Error' };
  } finally {
    busy.value = false;
  }
}

function act(action: 'accept' | 'reject' | 'cancel', confirmText?: string) {
  if (confirmText && !confirm(confirmText)) return;
  return run(() => $fetch(`/api/bounties/${bounty.value!.id}/${action}`, { method: 'POST' }));
}

function fill() {
  return run(() =>
    $fetch(`/api/bounties/${bounty.value!.id}/fill`, { method: 'POST', body: { infoHash: fillHash.value.trim() } })
  );
}

function contribute() {
  return run(async () => {
    await $fetch(`/api/bounties/${bounty.value!.id}/contribute`, { method: 'POST', body: { points: contribution.value } });
    contribution.value = 0;
  });
}
</script>
