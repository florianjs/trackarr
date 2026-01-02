<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:paint-brush" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Site Branding
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Preview -->
      <div class="p-4 bg-bg-tertiary rounded-lg border border-border">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
          Preview
        </p>
        <div class="flex items-center gap-2.5">
          <div
            class="w-7 h-7 bg-white rounded-sm flex items-center justify-center"
          >
            <Icon :name="siteLogo" class="text-black text-lg" />
          </div>
          <div class="flex flex-col leading-none">
            <span class="text-sm font-bold tracking-tighter uppercase">{{
              siteName || 'OpenTracker'
            }}</span>
            <span class="text-[10px] text-text-muted font-mono">v{{ useRuntimeConfig().public.appVersion }}</span>
          </div>
        </div>
      </div>

      <!-- Site Name -->
      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
        >
          Site Name
        </label>
        <input
          v-model="siteName"
          type="text"
          maxlength="50"
          class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
          placeholder="OpenTracker"
        />
        <p class="text-[10px] text-text-muted mt-1.5">
          Displayed in the navbar and browser title.
        </p>
      </div>

      <!-- Site Logo Icon -->
      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
        >
          Logo Icon
        </label>
        <div class="flex gap-2">
          <input
            v-model="siteLogo"
            type="text"
            maxlength="100"
            class="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono"
            placeholder="ph:broadcast-bold"
          />
          <div
            class="w-10 h-10 bg-bg-tertiary border border-border rounded flex items-center justify-center"
          >
            <Icon :name="siteLogo" class="text-xl text-text-secondary" />
          </div>
        </div>
        <p class="text-[10px] text-text-muted mt-1.5">
          Use Phosphor icon names (e.g., ph:broadcast-bold, ph:globe, ph:rocket).
        </p>
      </div>

      <!-- Common Icons -->
      <div>
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
          Quick Select
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="icon in commonIcons"
            :key="icon"
            @click="siteLogo = icon"
            class="w-9 h-9 bg-bg-tertiary border rounded flex items-center justify-center hover:bg-white/5 transition-colors"
            :class="siteLogo === icon ? 'border-white' : 'border-border'"
          >
            <Icon :name="icon" class="text-lg text-text-secondary" />
          </button>
        </div>
      </div>

      <!-- Save Button -->
      <button
        @click="saveBranding"
        :disabled="loading"
        class="w-full bg-text-primary text-bg-primary text-[10px] font-bold uppercase tracking-widest py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Icon v-if="loading" name="ph:circle-notch" class="animate-spin" />
        {{ loading ? 'Saving...' : 'Save Branding' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const siteName = ref('OpenTracker');
const siteLogo = ref('ph:broadcast-bold');
const loading = ref(false);

const commonIcons = [
  'ph:broadcast-bold',
  'ph:globe',
  'ph:rocket',
  'ph:lightning',
  'ph:fire',
  'ph:star',
  'ph:planet',
  'ph:atom',
  'ph:cube',
  'ph:diamond',
  'ph:crown',
  'ph:shield-check',
];

onMounted(async () => {
  try {
    const settings = await $fetch<{
      siteName: string;
      siteLogo: string;
    }>('/api/admin/settings');
    siteName.value = settings.siteName;
    siteLogo.value = settings.siteLogo;
  } catch (error) {
    console.error('Failed to load branding settings:', error);
  }
});

async function saveBranding() {
  loading.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        siteName: siteName.value,
        siteLogo: siteLogo.value,
      },
    });
  } catch (error) {
    console.error('Failed to save branding:', error);
  } finally {
    loading.value = false;
  }
}
</script>
