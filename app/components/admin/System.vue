<template>
  <div class="space-y-6">
    <!-- Version & Updates Section -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:package" class="text-text-muted" />
          <h3
            class="text-sm font-medium text-text-primary"
          >
            {{ t('admin.system.versionTitle') }}
          </h3>
        </div>
      </div>
      <div class="card-body space-y-4">
        <!-- Current Version -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">{{ t('admin.system.currentVersion') }}</p>
            <p class="text-xs text-text-muted mt-0.5">
              {{ t('admin.system.installedVersion') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="px-3 py-1.5 bg-bg-tertiary border border-border rounded font-mono text-sm text-text-primary"
            >
              v{{ versionInfo?.currentVersion || '...' }}
            </span>
            <button
              @click="checkUpdates"
              :disabled="checkingUpdates"
              class="p-2 bg-bg-tertiary border border-border rounded hover:border-white/20 transition-colors disabled:opacity-50"
              :title="t('admin.system.checkUpdates')"
            >
              <Icon
                name="ph:arrows-clockwise"
                :class="['text-text-muted', checkingUpdates && 'animate-spin']"
              />
            </button>
          </div>
        </div>

        <!-- Update Available -->
        <div
          v-if="versionInfo?.updateAvailable && versionInfo.latestRelease"
          class="p-4 bg-success/10 border border-success/30 rounded-lg space-y-3"
        >
          <div class="flex items-center gap-2">
            <Icon name="ph:arrow-circle-up" class="text-success" />
            <p class="text-sm font-medium text-success">
              {{ t('admin.system.updateAvailable', { version: versionInfo.latestRelease.version }) }}
            </p>
          </div>
          <p class="text-xs text-text-muted">
            {{ t('admin.system.published', { date: formatDate(versionInfo.latestRelease.publishedAt) }) }}
          </p>
          <a
            :href="versionInfo.latestRelease.url"
            target="_blank"
            class="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
          >
            {{ t('admin.system.viewChangelog') }}
            <Icon name="ph:arrow-square-out" class="text-xs" />
          </a>
        </div>

        <!-- No Update -->
        <div
          v-else-if="versionInfo && !versionInfo.updateAvailable"
          class="p-4 bg-bg-tertiary border border-border rounded-lg"
        >
          <div class="flex items-center gap-2">
            <Icon name="ph:check-circle" class="text-success" />
            <p class="text-sm text-text-muted">
              {{ t('admin.system.upToDate') }}
            </p>
          </div>
        </div>

        <!-- Update Instructions -->
        <div v-if="instructionsVisible && updateScript" class="space-y-3">
          <p class="text-xs text-text-muted">
            {{ t('admin.system.updateIntro', { directory: updateDirectory }) }}
          </p>
          <div class="relative bg-bg-tertiary border border-border rounded-lg p-3">
            <button
              @click="copyCommand(updateScript)"
              class="absolute top-2 right-2 text-text-muted hover:text-text-primary"
              :title="t('common.copy')"
            >
              <Icon :name="copied ? 'ph:check' : 'ph:copy'" class="text-xs" />
            </button>
            <pre class="text-xs font-mono text-text-primary whitespace-pre-wrap break-all pr-6">{{ updateScript }}</pre>
          </div>
          <div
            class="flex items-start gap-2 p-3 bg-leech/10 border border-leech/30 rounded-lg"
          >
            <Icon name="ph:warning" class="text-leech mt-0.5" />
            <div class="text-xs text-leech space-y-1">
              <p>{{ t('admin.system.backupWarning') }}</p>
              <p>{{ t('admin.system.downtimeWarning') }}</p>
            </div>
          </div>
        </div>

        <button
          v-if="!versionInfo?.updateAvailable"
          @click="toggleUpdateInstructions"
          class="w-full bg-bg-tertiary border border-border text-xs font-bold py-2.5 rounded hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="ph:terminal" />
          {{
            showUpdateInstructions
              ? t('admin.system.hideInstructions')
              : t('admin.system.showInstructions')
          }}
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();

interface VersionInfo {
  currentVersion: string;
  latestRelease: {
    version: string;
    name: string;
    publishedAt: string;
    url: string;
    notes: string;
  } | null;
  updateAvailable: boolean;
}

const versionInfo = ref<VersionInfo | null>(null);
const checkingUpdates = ref(false);
const showUpdateInstructions = ref(false);
const updateDirectory = ref('');
const updateScript = ref('');
const copied = ref(false);

// Shown on demand, and right away when a new version is out
const instructionsVisible = computed(
  () => showUpdateInstructions.value || !!versionInfo.value?.updateAvailable
);

onMounted(async () => {
  await checkUpdates();
});

async function checkUpdates() {
  checkingUpdates.value = true;
  try {
    versionInfo.value = await $fetch<VersionInfo>('/api/admin/system/version');
    if (versionInfo.value.updateAvailable) await loadUpdateScript();
  } catch (error) {
    console.error('Failed to check for updates:', error);
  } finally {
    checkingUpdates.value = false;
  }
}

async function loadUpdateScript() {
  if (updateScript.value) return;
  try {
    const data = await $fetch<{ directory: string; commands: string[] }>(
      '/api/admin/system/update'
    );
    updateDirectory.value = data.directory;
    updateScript.value = data.commands.join('\n');
  } catch (error) {
    console.error('Failed to fetch update commands:', error);
  }
}

async function toggleUpdateInstructions() {
  if (!showUpdateInstructions.value) await loadUpdateScript();
  showUpdateInstructions.value = !showUpdateInstructions.value;
}

async function copyCommand(command: string) {
  await navigator.clipboard.writeText(command);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>
