<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:house" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Homepage Content
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Hero Section -->
      <div class="space-y-4">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Hero Section
        </p>
        
        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Title
          </label>
          <input
            v-model="heroTitle"
            type="text"
            maxlength="50"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="OpenTracker"
          />
        </div>

        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Title Split Position ({{ heroTitleSplitPosition || Math.ceil(heroTitle.length / 2) }})
          </label>
          <input
            v-model.number="heroTitleSplitPosition"
            type="range"
            :min="1"
            :max="heroTitle.length"
            class="w-full"
          />
          <div class="mt-2 p-3 bg-bg-secondary border border-border rounded">
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Preview:</p>
            <div class="text-2xl font-black text-text-primary tracking-tighter uppercase">
              {{ titlePreview.first }}<span class="text-text-muted">{{ titlePreview.second }}</span>
            </div>
          </div>
        </div>

        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Subtitle
          </label>
          <textarea
            v-model="heroSubtitle"
            maxlength="500"
            rows="3"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 resize-none"
            placeholder="High-performance, minimalist P2P tracking engine..."
          />
        </div>

        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Status Badge
          </label>
          <input
            v-model="statusBadgeText"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Tracker Online & Operational"
          />
        </div>
      </div>

      <!-- Feature Boxes -->
      <div class="space-y-4 pt-4 border-t border-border">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Feature Boxes
        </p>

        <div v-for="(feature, index) in features" :key="index" class="space-y-2">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Feature {{ index + 1 }}
            </span>
          </div>
          <input
            v-model="feature.title"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Feature title"
          />
          <textarea
            v-model="feature.description"
            maxlength="500"
            rows="2"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 resize-none"
            placeholder="Feature description..."
          />
        </div>
      </div>

      <!-- Save Button -->
      <button
        @click="saveContent"
        :disabled="loading"
        class="w-full bg-text-primary text-bg-primary text-[10px] font-bold uppercase tracking-widest py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Icon v-if="loading" name="ph:circle-notch" class="animate-spin" />
        {{ loading ? 'Saving...' : 'Save Homepage Content' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const heroTitle = ref('OpenTracker');
const heroTitleSplitPosition = ref<number | null>(null);
const heroSubtitle = ref('High-performance, minimalist P2P tracking engine. Search through our indexed database of verified torrents.');
const statusBadgeText = ref('Tracker Online & Operational');
const features = ref([
  { title: 'High Performance', description: 'Built with Node.js and Redis for sub-millisecond response times and high concurrency support.' },
  { title: 'Multi-Protocol', description: 'Supports HTTP, UDP, and WebSocket protocols for maximum compatibility with all BitTorrent clients.' },
  { title: 'Open Source', description: 'Fully transparent and community-driven. Designed for privacy and efficiency in the P2P ecosystem.' },
]);
const loading = ref(false);

const titlePreview = computed(() => {
  const title = heroTitle.value;
  const splitPos = heroTitleSplitPosition.value || Math.ceil(title.length / 2);
  return {
    first: title.slice(0, splitPos),
    second: title.slice(splitPos),
  };
});

onMounted(async () => {
  try {
    const settings = await $fetch<{
      heroTitle: string;
      heroTitleSplitPosition: number | null;
      heroSubtitle: string;
      statusBadgeText: string;
      feature1Title: string;
      feature1Desc: string;
      feature2Title: string;
      feature2Desc: string;
      feature3Title: string;
      feature3Desc: string;
    }>('/api/admin/settings');
    
    heroTitle.value = settings.heroTitle;
    heroTitleSplitPosition.value = settings.heroTitleSplitPosition;
    heroSubtitle.value = settings.heroSubtitle;
    statusBadgeText.value = settings.statusBadgeText;
    features.value = [
      { title: settings.feature1Title, description: settings.feature1Desc },
      { title: settings.feature2Title, description: settings.feature2Desc },
      { title: settings.feature3Title, description: settings.feature3Desc },
    ];
  } catch (error) {
    console.error('Failed to load homepage content settings:', error);
  }
});

async function saveContent() {
  loading.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        heroTitle: heroTitle.value,
        heroTitleSplitPosition: heroTitleSplitPosition.value || Math.ceil(heroTitle.value.length / 2),
        heroSubtitle: heroSubtitle.value,
        statusBadgeText: statusBadgeText.value,
        feature1Title: features.value[0]?.title ?? '',
        feature1Desc: features.value[0]?.description ?? '',
        feature2Title: features.value[1]?.title ?? '',
        feature2Desc: features.value[1]?.description ?? '',
        feature3Title: features.value[2]?.title ?? '',
        feature3Desc: features.value[2]?.description ?? '',
      },
    });
  } catch (error) {
    console.error('Failed to save homepage content:', error);
  } finally {
    loading.value = false;
  }
}
</script>
