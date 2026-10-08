<template>
  <div class="space-y-6">
    <!-- Greeting -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ greeting }}</h1>
        <p v-if="memberSince" class="text-sm text-text-muted mt-0.5">
          {{ t('dashboard.memberSince', { date: memberSince }) }}
        </p>
      </div>
      <div class="flex gap-2">
        <NuxtLink to="/torrents" class="btn btn-secondary">
          <Icon name="ph:files" aria-hidden="true" />{{ t('dashboard.browse') }}
        </NuxtLink>
        <button type="button" class="btn btn-primary" @click="showUpload = true">
          <Icon name="ph:upload-simple" aria-hidden="true" />{{ t('dashboard.upload') }}
        </button>
      </div>
    </div>

    <!-- Account strip: the numbers a member checks every visit -->
    <section class="card grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border" :aria-label="t('dashboard.account')">
      <div class="p-4 col-span-2 md:col-span-1">
        <p class="text-xs text-text-muted">{{ t('shell.meter.ratio') }}</p>
        <p class="num text-3xl font-medium mt-1" :class="ratioClass">{{ ratioLabel }}</p>
        <p class="num text-xs mt-1 space-x-3">
          <span class="text-seed">↑ {{ formatSize(account.uploaded) }}</span>
          <span class="text-leech">↓ {{ formatSize(account.downloaded) }}</span>
        </p>
      </div>
      <div class="p-4">
        <p class="text-xs text-text-muted">{{ t('dashboard.seeding') }}</p>
        <p class="num text-3xl font-medium mt-1">{{ account.seeding }}</p>
        <p class="text-xs text-text-muted mt-1">
          {{ t('dashboard.leeching', { n: account.leeching }, account.leeching) }}
        </p>
      </div>
      <NuxtLink
        v-if="account.points !== null"
        to="/shop"
        class="p-4 hover:bg-bg-hover/60 transition-colors"
      >
        <p class="text-xs text-text-muted">{{ t('dashboard.points') }}</p>
        <p class="num text-3xl font-medium mt-1">{{ Math.floor(account.points).toLocaleString(locale) }}</p>
        <p class="text-xs text-text-muted mt-1">{{ t('dashboard.spendPoints') }}</p>
      </NuxtLink>
      <NuxtLink
        :to="user ? `/users/${user.id}` : '/'"
        class="p-4 hover:bg-bg-hover/60 transition-colors"
      >
        <p class="text-xs text-text-muted">{{ t('dashboard.hnr') }}</p>
        <p class="num text-3xl font-medium mt-1" :class="account.hnr > 0 ? 'text-danger' : ''">{{ account.hnr }}</p>
        <p class="text-xs mt-1" :class="account.hnr > 0 ? 'text-danger' : 'text-text-muted'">
          {{ account.hnr > 0 ? t('dashboard.hnrWarning') : t('dashboard.hnrNone') }}
        </p>
      </NuxtLink>
    </section>

    <!-- Note from the staff (Admin > Branding > Welcome message) -->
    <section v-if="data?.welcomeMessage" class="card p-4 flex gap-3">
      <Icon name="ph:megaphone-simple" class="text-lg text-text-muted shrink-0 mt-0.5" aria-hidden="true" />
      <div class="prose-sm text-sm text-text-secondary [&_a]:underline" v-html="data.welcomeMessage" />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- New torrents -->
      <section class="card lg:col-span-2 overflow-hidden">
        <div class="card-header">
          <h2 class="text-sm font-medium">{{ t('dashboard.latest') }}</h2>
          <NuxtLink to="/torrents" class="text-xs text-text-muted hover:text-text-primary">{{ t('dashboard.seeAll') }}</NuxtLink>
        </div>
        <table v-if="data?.latest.length" class="data-table">
          <thead>
            <tr>
              <th>{{ t('dashboard.columns.name') }}</th>
              <th class="text-right hidden sm:table-cell">{{ t('dashboard.columns.size') }}</th>
              <th class="text-right" :title="t('dashboard.columns.seeders')">
                <span class="text-seed" aria-hidden="true">↑</span><span class="sr-only">{{ t('dashboard.columns.seeders') }}</span>
              </th>
              <th class="text-right" :title="t('dashboard.columns.leechers')">
                <span class="text-leech" aria-hidden="true">↓</span><span class="sr-only">{{ t('dashboard.columns.leechers') }}</span>
              </th>
              <th class="text-right hidden md:table-cell">{{ t('dashboard.columns.age') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="torrent in data.latest" :key="torrent.infoHash">
              <td class="max-w-0 w-full">
                <NuxtLink :to="`/torrents/${torrent.infoHash}`" class="block truncate text-text-primary hover:underline underline-offset-2">
                  {{ torrent.name }}
                </NuxtLink>
                <span v-if="torrent.category" class="text-xs text-text-muted">{{ torrent.category }}</span>
              </td>
              <td class="num text-right text-text-secondary whitespace-nowrap hidden sm:table-cell">{{ formatSize(torrent.size) }}</td>
              <td class="num text-right text-seed">{{ torrent.seeders }}</td>
              <td class="num text-right text-leech">{{ torrent.leechers }}</td>
              <td class="num text-right text-text-muted whitespace-nowrap hidden md:table-cell">{{ formatAge(torrent.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="card-body text-sm text-text-muted">
          {{ t('dashboard.noTorrents') }}
          <button type="button" class="text-text-primary underline underline-offset-2" @click="showUpload = true">{{ t('dashboard.uploadFirst') }}</button>
        </div>
      </section>

      <div class="space-y-6">
        <!-- Open bounties -->
        <section v-if="account.points !== null" class="card">
          <div class="card-header">
            <h2 class="text-sm font-medium">{{ t('dashboard.bounties') }}</h2>
            <NuxtLink to="/bounties" class="text-xs text-text-muted hover:text-text-primary">{{ t('dashboard.seeAll') }}</NuxtLink>
          </div>
          <ul v-if="data?.bounties.length" class="divide-y divide-border">
            <li v-for="bounty in data.bounties" :key="bounty.id">
              <NuxtLink :to="`/bounties/${bounty.id}`" class="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg-hover/60">
                <span class="text-sm truncate">{{ bounty.title }}</span>
                <span class="num text-xs text-text-secondary shrink-0">{{ t('bonus.points', { n: Math.floor(bounty.totalPoints).toLocaleString(locale) }) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="card-body text-sm text-text-muted">
            {{ t('dashboard.noBounties') }}
            <NuxtLink to="/bounties" class="text-text-primary underline underline-offset-2">{{ t('dashboard.requestTorrent') }}</NuxtLink>
          </p>
        </section>

        <!-- Forum -->
        <section class="card">
          <div class="card-header">
            <h2 class="text-sm font-medium">{{ t('dashboard.forum') }}</h2>
            <NuxtLink to="/forum" class="text-xs text-text-muted hover:text-text-primary">{{ t('dashboard.seeAll') }}</NuxtLink>
          </div>
          <ul v-if="data?.topics.length" class="divide-y divide-border">
            <li v-for="topic in data.topics" :key="topic.id">
              <NuxtLink :to="`/forum/topic/${topic.id}`" class="block px-4 py-2.5 hover:bg-bg-hover/60">
                <span class="block text-sm truncate">{{ topic.title }}</span>
                <span class="block text-xs text-text-muted truncate">
                  {{ [topic.category, topic.author, formatAge(String(topic.updatedAt))].filter(Boolean).join(', ') }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="card-body text-sm text-text-muted">
            {{ t('dashboard.noTopics') }}
            <NuxtLink to="/forum" class="text-text-primary underline underline-offset-2">{{ t('dashboard.startTopic') }}</NuxtLink>
          </p>
        </section>
      </div>
    </div>

    <UploadTorrentModal :is-open="showUpload" @close="showUpload = false" @uploaded="refresh()" />
  </div>
</template>

<script setup lang="ts">
interface Dashboard {
  account: {
    uploaded: number;
    downloaded: number;
    memberSince: string | null;
    points: number | null;
    seeding: number;
    leeching: number;
    hnr: number;
  };
  welcomeMessage: string | null;
  latest: {
    infoHash: string;
    name: string;
    size: number;
    createdAt: string;
    category: string | null;
    seeders: number;
    leechers: number;
  }[];
  bounties: { id: string; title: string; totalPoints: number }[];
  topics: { id: string; title: string; updatedAt: string; author: string | null; category: string | null }[];
}

const { t, locale } = useI18n();
const { user } = useUserSession();
const { data, refresh } = await useFetch<Dashboard>('/api/dashboard');

useHead({ title: () => t('shell.nav.home') });

const showUpload = ref(false);

const account = computed(
  () =>
    data.value?.account ?? {
      uploaded: 0, downloaded: 0, memberSince: null, points: null, seeding: 0, leeching: 0, hnr: 0,
    }
);

// Time of day comes from the browser clock, after hydration (the server may
// be in another timezone)
const hour = ref<number | null>(null);
onMounted(() => (hour.value = new Date().getHours()));
const greeting = computed(() => {
  const h = hour.value;
  const key =
    h === null ? 'neutral' : h < 5 || h >= 18 ? 'evening' : h < 12 ? 'morning' : 'afternoon';
  return t(`dashboard.greeting.${key}`, { name: user.value?.username ?? '' });
});

const memberSince = computed(() =>
  account.value.memberSince
    ? new Date(account.value.memberSince).toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
    : null
);

const ratio = computed(() => {
  const { uploaded, downloaded } = account.value;
  return downloaded === 0 ? (uploaded > 0 ? Infinity : 0) : uploaded / downloaded;
});
const ratioLabel = computed(() => (ratio.value === Infinity ? '∞' : ratio.value.toFixed(2)));
const ratioClass = computed(() => {
  const { uploaded, downloaded } = account.value;
  if (uploaded === 0 && downloaded === 0) return 'text-text-secondary';
  if (ratio.value < 0.5) return 'text-danger';
  if (ratio.value < 1) return 'text-leech';
  return 'text-seed';
});
</script>
