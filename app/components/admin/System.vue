<template>
  <div class="space-y-6">
    <!-- Version & Updates Section -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:package" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Version & Updates
          </h3>
        </div>
      </div>
      <div class="card-body space-y-4">
        <!-- Current Version -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-text-primary">Current Version</p>
            <p class="text-[10px] text-text-muted mt-0.5">
              Installed version of OpenTracker
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
              title="Check for updates"
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
              Update Available: {{ versionInfo.latestRelease.version }}
            </p>
          </div>
          <p class="text-xs text-text-muted">
            Published {{ formatDate(versionInfo.latestRelease.publishedAt) }}
          </p>
          <a
            :href="versionInfo.latestRelease.url"
            target="_blank"
            class="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
          >
            View changelog
            <Icon name="ph:arrow-square-out" class="text-[10px]" />
          </a>
        </div>

        <!-- No Update -->
        <div
          v-else-if="versionInfo && !versionInfo.updateAvailable"
          class="p-4 bg-bg-tertiary border border-border rounded-lg"
        >
          <div class="flex items-center gap-2">
            <Icon name="ph:check-circle" class="text-success" />
            <p class="text-sm text-text-muted">You're running the latest version</p>
          </div>
        </div>

        <!-- Update Instructions -->
        <div v-if="showUpdateInstructions" class="space-y-3">
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
          >
            Update Commands
          </p>
          <div class="space-y-2">
            <div
              v-for="cmd in updateCommands"
              :key="cmd.step"
              class="bg-bg-tertiary border border-border rounded-lg p-3"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-text-muted">
                  Step {{ cmd.step }}: {{ cmd.description }}
                </span>
                <button
                  @click="copyCommand(cmd.command)"
                  class="text-text-muted hover:text-text-primary"
                  title="Copy"
                >
                  <Icon name="ph:copy" class="text-xs" />
                </button>
              </div>
              <code class="block text-xs font-mono text-text-primary break-all">
                {{ cmd.command }}
              </code>
            </div>
          </div>
          <div class="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <Icon name="ph:warning" class="text-yellow-400 mt-0.5" />
            <div class="text-xs text-yellow-400 space-y-1">
              <p>Backup your database before updating</p>
              <p>The update will cause a brief downtime</p>
            </div>
          </div>
        </div>

        <button
          @click="toggleUpdateInstructions"
          class="w-full bg-bg-tertiary border border-border text-[10px] font-bold uppercase tracking-widest py-2.5 rounded hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="ph:terminal" />
          {{ showUpdateInstructions ? 'Hide' : 'Show' }} Update Instructions
        </button>
      </div>
    </div>

    <!-- Grafana Password Section -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:chart-line" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Grafana Password
          </h3>
        </div>
      </div>
      <div class="card-body space-y-4">
        <p class="text-xs text-text-muted">
          Change the Grafana admin password. You'll need your current password.
        </p>

        <!-- Current Password -->
        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Current Password
          </label>
          <input
            v-model="grafana.currentPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Enter current Grafana password"
          />
        </div>

        <!-- New Password -->
        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            New Password
          </label>
          <input
            v-model="grafana.newPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Enter new password (min. 8 characters)"
          />
        </div>

        <!-- Confirm Password -->
        <div>
          <label
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2"
          >
            Confirm New Password
          </label>
          <input
            v-model="grafana.confirmPassword"
            type="password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Confirm new password"
          />
        </div>

        <!-- Error / Success Messages -->
        <div
          v-if="grafana.error"
          class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"
        >
          <Icon name="ph:warning-circle" class="text-red-400" />
          <p class="text-sm text-red-400">{{ grafana.error }}</p>
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
          class="w-full bg-text-primary text-bg-primary text-[10px] font-bold uppercase tracking-widest py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon v-if="grafana.loading" name="ph:circle-notch" class="animate-spin" />
          {{ grafana.loading ? 'Updating...' : 'Update Grafana Password' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
      const data = await $fetch<{ commands: UpdateCommand[] }>('/api/admin/system/update');
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

    grafana.success = 'Grafana password updated successfully';
    grafana.currentPassword = '';
    grafana.newPassword = '';
    grafana.confirmPassword = '';
  } catch (error: any) {
    grafana.error = error.data?.message || 'Failed to update Grafana password';
  } finally {
    grafana.loading = false;
  }
}

function copyCommand(command: string) {
  navigator.clipboard.writeText(command);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>
