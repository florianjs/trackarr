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
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          Hero Section
        </p>

        <SettingsGroup
          label="Title"
          description="The main headline on the homepage. Use rich text for custom styling, colors, and fonts."
        >
          <WysiwygEditor
            v-model="heroTitle"
            placeholder="OpenTracker"
            :maxLength="500"
          />
        </SettingsGroup>

        <SettingsGroup
          label="Subtitle"
          description="A short description below the title. Supports rich text."
        >
          <WysiwygEditor
            v-model="heroSubtitle"
            placeholder="High-performance, minimalist P2P tracking engine..."
            :maxLength="1000"
          />
        </SettingsGroup>

        <SettingsGroup
          label="Status Badge (Online)"
          description="Text shown in the pill badge above the title."
        >
          <input
            v-model="statusBadgeTextOnline"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Tracker Online & Operational"
          />
        </div>

        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Status Badge (Offline)
          </label>
          <input
            v-model="statusBadgeTextOffline"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Tracker Offline"
          />
        </div>
      </div>

      <!-- Feature Boxes -->
      <div class="space-y-4 pt-4 border-t border-border">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          Feature Boxes
        </p>

        <SettingsGroup
          v-for="(feature, index) in features"
          :key="index"
          :label="`Feature ${index + 1}`"
          description="Title and description for this feature card. Supports rich text."
        >
          <div class="space-y-3">
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >Title</label
              >
              <WysiwygEditor
                v-model="feature.title"
                placeholder="Feature title"
                :maxLength="300"
              />
            </div>
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >Description</label
              >
              <WysiwygEditor
                v-model="feature.description"
                placeholder="Feature description..."
                :maxLength="1000"
              />
            </div>
          </div>
        </SettingsGroup>
      </div>

      <!-- Save Button -->
      <button
        @click="saveContent"
        :disabled="loading || saved"
        class="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        :class="
          saved
            ? 'bg-success text-white'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon v-if="loading" name="ph:circle-notch" class="animate-spin" />
        <Icon v-else-if="saved" name="ph:check-bold" />
        {{ loading ? 'Saving...' : saved ? 'Saved' : 'Save Homepage Content' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const heroTitle = ref('OpenTracker');
const heroSubtitle = ref(
  'High-performance, minimalist P2P tracking engine. Search through our indexed database of verified torrents.'
);
const statusBadgeText = ref('Tracker Online & Operational');
const features = ref([
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
]);
const loading = ref(false);
const saved = ref(false);

onMounted(async () => {
  try {
    const settings = await $fetch<{
      heroTitle: string;
      heroSubtitle: string;
      statusBadgeTextOnline: string;
      statusBadgeTextOffline: string;
      feature1Title: string;
      feature1Desc: string;
      feature2Title: string;
      feature2Desc: string;
      feature3Title: string;
      feature3Desc: string;
    }>('/api/admin/settings');

    heroTitle.value = settings.heroTitle;
    heroSubtitle.value = settings.heroSubtitle;
    statusBadgeTextOnline.value = settings.statusBadgeTextOnline;
    statusBadgeTextOffline.value = settings.statusBadgeTextOffline;
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
        heroSubtitle: heroSubtitle.value,
        statusBadgeTextOnline: statusBadgeTextOnline.value,
        statusBadgeTextOffline: statusBadgeTextOffline.value,
        feature1Title: features.value[0]?.title ?? '',
        feature1Desc: features.value[0]?.description ?? '',
        feature2Title: features.value[1]?.title ?? '',
        feature2Desc: features.value[1]?.description ?? '',
        feature3Title: features.value[2]?.title ?? '',
        feature3Desc: features.value[2]?.description ?? '',
      },
    });
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save homepage content:', error);
  } finally {
    loading.value = false;
  }
}
</script>
