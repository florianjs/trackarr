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
        <div v-if="showUpdateInstructions" class="space-y-3">
          <p
            class="text-xs font-bold text-text-muted"
          >
            {{ t('admin.system.updateCommands') }}
          </p>
          <div class="space-y-2">
            <div
              v-for="cmd in updateCommands"
              :key="cmd.step"
              class="bg-bg-tertiary border border-border rounded-lg p-3"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-text-muted">
                  {{ t('admin.system.step', { step: cmd.step, description: cmd.description }) }}
                </span>
                <button
                  @click="copyCommand(cmd.command)"
                  class="text-text-muted hover:text-text-primary"
                  :title="t('common.copy')"
                >
                  <Icon name="ph:copy" class="text-xs" />
                </button>
              </div>
              <code class="block text-xs font-mono text-text-primary break-all">
                {{ cmd.command }}
              </code>
            </div>
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

    <!-- Grafana Password Section -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:chart-line" class="text-text-muted" />
          <h3
            class="text-sm font-medium text-text-primary"
          >
            {{ t('admin.system.grafanaTitle') }}
          </h3>
        </div>
      </div>
      <div class="card-body space-y-4">
        <p class="text-xs text-text-muted mb-6">
          {{ t('admin.system.grafanaIntro') }}
        </p>

        <SettingsGroup
          :label="t('admin.system.currentPassword')"
          :description="t('admin.system.currentPasswordDescription')"
        >
          <input
            v-model="grafana.currentPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="t('admin.system.currentPasswordPlaceholder')"
          />
        </SettingsGroup>

        <SettingsGroup
          :label="t('admin.system.newPassword')"
          :description="t('admin.system.newPasswordDescription')"
        >
          <input
            v-model="grafana.newPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="t('admin.system.newPasswordPlaceholder')"
          />
        </SettingsGroup>

        <SettingsGroup
          :label="t('admin.system.confirmPassword')"
          :description="t('admin.system.confirmPasswordDescription')"
        >
          <input
            v-model="grafana.confirmPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="t('admin.system.confirmPasswordPlaceholder')"
          />
        </SettingsGroup>

        <!-- Error / Success Messages -->
        <div
          v-if="grafana.error"
          class="p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2"
        >
          <Icon name="ph:warning-circle" class="text-danger" />
          <p class="text-sm text-danger">{{ grafana.error }}</p>
        </div>

        <div
          v-if="grafana.success"
          class="p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2"
        >
          <Icon name="ph:check-circle" class="text-success" />
          <p class="text-sm text-success">{{ grafana.success }}</p>
        </div>

        <button
          @click="changeGrafanaPassword"
          :disabled="grafana.loading || !isGrafanaFormValid"
          class="w-full bg-text-primary text-bg-primary text-xs font-bold py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon
            v-if="grafana.loading"
            name="ph:circle-notch"
            class="animate-spin"
          />
          {{ grafana.loading ? t('admin.system.updating') : t('admin.system.updateGrafanaPassword') }}
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

interface UpdateCommand {
  step: number;
  description: string;
  command: string;
}

const versionInfo = ref<VersionInfo | null>(null);
const checkingUpdates = ref(false);
const showUpdateInstructions = ref(false);
const updateCommands = ref<UpdateCommand[]>([]);

const grafana = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  loading: false,
  error: '',
  success: '',
});

const isGrafanaFormValid = computed(() => {
  return (
    grafana.currentPassword.length > 0 &&
    grafana.newPassword.length >= 8 &&
    grafana.newPassword === grafana.confirmPassword
  );
});

onMounted(async () => {
  await checkUpdates();
});

async function checkUpdates() {
  checkingUpdates.value = true;
  try {
    versionInfo.value = await $fetch<VersionInfo>('/api/admin/system/version');
  } catch (error) {
    console.error('Failed to check for updates:', error);
  } finally {
    checkingUpdates.value = false;
  }
}

async function toggleUpdateInstructions() {
  if (!showUpdateInstructions.value && updateCommands.value.length === 0) {
    try {
      const data = await $fetch<{ commands: UpdateCommand[] }>(
        '/api/admin/system/update'
      );
      updateCommands.value = data.commands;
    } catch (error) {
      console.error('Failed to fetch update commands:', error);
    }
  }
  showUpdateInstructions.value = !showUpdateInstructions.value;
}

async function changeGrafanaPassword() {
  grafana.error = '';
  grafana.success = '';
  grafana.loading = true;

  try {
    await $fetch('/api/admin/system/grafana-password', {
      method: 'POST',
      body: {
        currentPassword: grafana.currentPassword,
        newPassword: grafana.newPassword,
      },
    });

    grafana.success = t('admin.system.grafanaSuccess');
    grafana.currentPassword = '';
    grafana.newPassword = '';
    grafana.confirmPassword = '';
  } catch (error: any) {
    grafana.error = error.data?.message || t('admin.system.grafanaFailed');
  } finally {
    grafana.loading = false;
  }
}

function copyCommand(command: string) {
  navigator.clipboard.writeText(command);
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
