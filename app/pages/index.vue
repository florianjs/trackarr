<template>
  <div class="max-w-5xl mx-auto py-12">
    <!-- Hero Section -->
    <div class="text-center mb-16">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-secondary border border-border mb-6"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-2 w-2 bg-success"
          ></span>
        </span>
        <span
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
          >{{
            content?.statusBadgeText ?? 'Tracker Online & Operational'
          }}</span
        >
      </div>
      <h1
        class="text-4xl md:text-6xl font-black text-text-primary tracking-tighter mb-4 hero-title"
        v-html="
          content?.heroTitle ||
          'TRACKARR'
        "
      ></h1>
      <div
        class="text-sm text-text-muted font-mono max-w-xl mx-auto mb-10 hero-subtitle"
        v-html="
          content?.heroSubtitle ||
          'High-performance, minimalist P2P tracking engine. Search through our indexed database of verified torrents.'
        "
      ></div>

      <!-- Search Bar -->
      <div class="max-w-2xl mx-auto">
        <SearchBar
          v-model="search"
          placeholder="Search torrents by name, tag or infohash..."
          size="lg"
          @search="handleSearch"
        />
        <div class="flex flex-wrap justify-center gap-4 mt-6">
          <div
            class="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest"
          >
            <Icon name="ph:package" />
            <span>{{ stats?.live?.torrents ?? 0 }} Torrents</span>
          </div>
          <div
            class="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest"
          >
            <Icon name="ph:users-three" />
            <span>{{ stats?.cached?.peers ?? 0 }} Peers</span>
          </div>
          <div
            class="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest"
          >
            <Icon name="ph:lightning" />
            <span>Ultra-low Latency</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="space-y-4">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <Icon name="ph:clock-counter-clockwise" class="text-text-muted" />
          <h3 class="text-xs font-bold uppercase tracking-wider">
            Recently Indexed
          </h3>
        </div>
        <NuxtLink
          to="/torrents"
          class="text-[10px] font-bold uppercase text-text-muted hover:text-white transition-colors flex items-center gap-1"
        >
          Browse all <Icon name="ph:arrow-right" />
        </NuxtLink>
      </div>
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <TorrentTable :torrents="recentTorrents" :compact="true" />
        </div>
      </div>
    </div>

    <!-- Info Section -->
    <div
      class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 border-t border-border pt-12"
    >
      <div
        v-for="(feature, index) in features"
        :key="index"
        class="feature-box"
      >
        <h4
          class="feature-title text-xs font-bold uppercase tracking-widest text-text-primary mb-3"
          v-html="feature.title"
        />
        <div
          class="feature-description text-xs text-text-muted leading-relaxed font-mono"
          v-html="feature.description"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TrackerStats {
  status: string;
  cached: {
    torrents: number;
    peers: number;
    seeders: number;
    updatedAt: number;
  };
  live: {
    torrents: number;
    peers: number;
  };
  protocols: {
    http: boolean;
    udp: boolean;
    ws: boolean;
  };
}

interface TorrentWithStats {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  createdAt: string;
  stats: {
    seeders: number;
    leechers: number;
    completed: number;
  };
}

interface HomepageContent {
  heroTitle: string;
  heroSubtitle: string;
  statusBadgeText: string;
  features: { title: string; description: string }[];
}

const search = ref('');
const router = useRouter();

function handleSearch() {
  if (!search.value.trim()) return;
  router.push({
    path: '/search',
    query: { q: search.value.trim() },
  });
}

// Fetch homepage content
const { data: content } = await useFetch<HomepageContent>(
  '/api/homepage-content'
);

// Features with defaults
const features = computed(() => {
  return (
    content.value?.features ?? [
      {
        title: 'High Performance',
        description:
          'Built with Node.js and Redis for sub-millisecond response times and high concurrency support.',
      },
      {
        title: 'Multi-Protocol',
        description:
          'Supports HTTP, UDP, and WebSocket protocols for maximum compatibility with all BitTorrent clients.',
      },
      {
        title: 'Open Source',
        description:
          'Fully transparent and community-driven. Designed for privacy and efficiency in the P2P ecosystem.',
      },
    ]
  );
});

// Fetch tracker stats for the hero section
const { data: stats } = await useFetch<TrackerStats>('/api/admin/stats');

// Fetch recent torrents
const { data: torrentsData } = await useFetch<{ data: TorrentWithStats[] }>(
  '/api/torrents',
  {
    query: { limit: 10 },
  }
);

const recentTorrents = computed(() => torrentsData.value?.data ?? []);
</script>

<style>
/* Hero title styles - allow rich text formatting */
.hero-title p {
  margin: 0;
  display: inline;
}

.hero-title strong {
  font-weight: 900;
}

.hero-title em {
  font-style: italic;
}

/* Hero subtitle styles */
.hero-subtitle p {
  margin: 0;
}

.hero-subtitle strong {
  font-weight: 700;
}

.hero-subtitle a {
  color: var(--text-primary);
  text-decoration: underline;
}

/* Feature box styles - allow rich text formatting */
.feature-title p {
  margin: 0;
  display: inline;
}

.feature-title strong {
  font-weight: 900;
}

.feature-description p {
  margin: 0 0 0.5rem 0;
}

.feature-description p:last-child {
  margin-bottom: 0;
}

.feature-description strong {
  font-weight: 700;
  color: var(--text-primary);
}

.feature-description em {
  font-style: italic;
}

.feature-description a {
  color: var(--text-primary);
  text-decoration: underline;
}

.feature-description ul,
.feature-description ol {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.feature-description li {
  margin: 0.25rem 0;
}
</style>
