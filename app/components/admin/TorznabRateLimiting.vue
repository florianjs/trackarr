<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:gauge" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          {{ t('admin.torznabRateLimit.title') }}
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <p class="text-xs text-text-muted">
        {{ t('admin.torznabRateLimit.intro') }}
      </p>

      <!-- Time Window -->
      <SettingsGroup
        :label="t('admin.torznabRateLimit.windowLabel')"
        :description="t('admin.torznabRateLimit.windowDescription')"
      >
        <div class="flex items-center gap-3">
          <input
            v-model.number="localWindow"
            type="number"
            min="10"
            max="3600"
            class="w-24 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
          />
          <span class="text-sm text-text-muted">{{
            t('admin.torznabRateLimit.seconds')
          }}</span>
          <div class="flex-1" />
          <span class="text-[10px] text-text-muted font-mono">
            = {{ formatDuration(localWindow) }}
          </span>
        </div>
      </SettingsGroup>

      <!-- Search Rate Limit -->
      <SettingsGroup
        :label="t('admin.torznabRateLimit.searchLabel')"
        :description="t('admin.torznabRateLimit.searchDescription')"
      >
        <div class="flex items-center gap-3">
          <input
            v-model.number="localSearchLimit"
            type="number"
            min="1"
            max="1000"
            class="w-24 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
          />
          <span class="text-sm text-text-muted">{{
            t('admin.torznabRateLimit.perWindow', {
              window: formatDuration(localWindow),
            })
          }}</span>
        </div>
        <div class="mt-2">
          <div class="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-success to-yellow-500"
              :style="{
                width: `${Math.min((localSearchLimit / 100) * 100, 100)}%`,
              }"
            />
          </div>
          <div class="flex justify-between mt-1 text-[10px] text-text-muted">
            <span>{{ t('admin.torznabRateLimit.strict') }}</span>
            <span>{{ t('admin.torznabRateLimit.generous') }}</span>
          </div>
        </div>
      </SettingsGroup>

      <!-- Download Rate Limit -->
      <SettingsGroup
        :label="t('admin.torznabRateLimit.downloadLabel')"
        :description="t('admin.torznabRateLimit.downloadDescription')"
      >
        <div class="flex items-center gap-3">
          <input
            v-model.number="localDownloadLimit"
            type="number"
            min="1"
            max="500"
            class="w-24 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
          />
          <span class="text-sm text-text-muted">{{
            t('admin.torznabRateLimit.perWindow', {
              window: formatDuration(localWindow),
            })
          }}</span>
        </div>
        <div class="mt-2">
          <div class="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-success to-yellow-500"
              :style="{
                width: `${Math.min((localDownloadLimit / 50) * 100, 100)}%`,
              }"
            />
          </div>
          <div class="flex justify-between mt-1 text-[10px] text-text-muted">
            <span>{{ t('admin.torznabRateLimit.strict') }}</span>
            <span>{{ t('admin.torznabRateLimit.generous') }}</span>
          </div>
        </div>
      </SettingsGroup>

      <!-- Presets -->
      <div class="border-t border-border pt-4">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
        >
          {{ t('admin.torznabRateLimit.presets') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in presets"
            :key="preset.name"
            @click="applyPreset(preset)"
            class="px-3 py-1.5 bg-bg-tertiary border border-border rounded text-xs hover:border-white/20 transition-colors"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Save Button -->
      <div
        class="flex items-center justify-between border-t border-border pt-4"
      >
        <p class="text-xs text-text-muted">
          <Icon name="ph:info" class="inline-block align-[-2px] mr-1" />
          {{ t('admin.torznabRateLimit.immediateNote') }}
        </p>
        <button
          @click="saveChanges"
          :disabled="!hasChanges || saving"
          class="px-4 py-2 bg-text-primary text-bg-primary text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          <Icon v-if="saving" name="ph:circle-notch" class="animate-spin" />
          {{ saving ? t('common.saving') : t('common.saveChanges') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

interface TorznabConfig {
  enabled: boolean;
  rateLimitSearch: number;
  rateLimitDownload: number;
  rateLimitWindow: number;
  enableLogging: boolean;
  allowedCategories: string[];
}

interface Preset {
  name: string;
  window: number;
  search: number;
  download: number;
}

const props = defineProps<{
  config?: TorznabConfig;
  loading?: boolean;
}>();

const emit = defineEmits<{
  update: [updates: Partial<TorznabConfig>];
}>();

const saving = ref(false);

// Local state for editing
const localWindow = ref(props.config?.rateLimitWindow || 60);
const localSearchLimit = ref(props.config?.rateLimitSearch || 30);
const localDownloadLimit = ref(props.config?.rateLimitDownload || 20);

// Sync with props
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      localWindow.value = newConfig.rateLimitWindow;
      localSearchLimit.value = newConfig.rateLimitSearch;
      localDownloadLimit.value = newConfig.rateLimitDownload;
    }
  },
  { immediate: true }
);

const hasChanges = computed(() => {
  if (!props.config) return false;
  return (
    localWindow.value !== props.config.rateLimitWindow ||
    localSearchLimit.value !== props.config.rateLimitSearch ||
    localDownloadLimit.value !== props.config.rateLimitDownload
  );
});

const presets = computed<Preset[]>(() => [
  { name: t('admin.torznabRateLimit.strict'), window: 60, search: 10, download: 5 },
  { name: t('admin.torznabRateLimit.default'), window: 60, search: 30, download: 20 },
  { name: t('admin.torznabRateLimit.relaxed'), window: 60, search: 60, download: 40 },
  { name: t('admin.torznabRateLimit.generous'), window: 60, search: 100, download: 50 },
]);

function applyPreset(preset: Preset) {
  localWindow.value = preset.window;
  localSearchLimit.value = preset.search;
  localDownloadLimit.value = preset.download;
}

async function saveChanges() {
  saving.value = true;
  try {
    emit('update', {
      rateLimitWindow: localWindow.value,
      rateLimitSearch: localSearchLimit.value,
      rateLimitDownload: localDownloadLimit.value,
    });
  } finally {
    setTimeout(() => {
      saving.value = false;
    }, 500);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
</script>
