<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:user-plus" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Registration
        </h3>
      </div>
    </div>
    <div class="card-body">
      <!-- Open Registration Toggle -->
      <SettingsGroup
        label="Open Registration"
        description="Allow new users to create accounts freely."
      >
        <div class="flex items-center gap-3">
          <button
            @click="toggleRegistration"
            :disabled="settingsLoading"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            :class="
              registrationOpen
                ? 'bg-success'
                : 'bg-bg-tertiary border border-border'
            "
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="registrationOpen ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
          <span class="text-xs text-text-muted">
            {{ registrationOpen ? 'Open' : 'Closed' }}
          </span>
        </div>
      </SettingsGroup>

      <!-- Invite Only Mode Toggle -->
      <SettingsGroup
        label="Invite Only Mode"
        description="Require invitation code for registration."
      >
        <div class="flex items-center gap-3">
          <button
            @click="toggleInviteEnabled"
            :disabled="settingsLoading"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            :class="
              inviteEnabled
                ? 'bg-accent'
                : 'bg-bg-tertiary border border-border'
            "
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="inviteEnabled ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
          <span class="text-xs text-text-muted">
            {{ inviteEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
      </SettingsGroup>

      <!-- Status Indicator -->
      <div
        class="my-6 p-4 rounded-lg border flex items-center gap-3"
        :class="getStatusClass()"
      >
        <Icon
          :name="getStatusIcon()"
          class="text-xl"
          :class="getStatusIconClass()"
        />
        <div class="flex-1">
          <p class="text-sm font-semibold" :class="getStatusTextClass()">
            Current Status: {{ getStatusText() }}
          </p>
        </div>
      </div>

      <div class="space-y-0">
        <!-- Default Invites Per User -->
        <SettingsGroup
          v-if="inviteEnabled"
          label="Default Invites"
          description="Number of invitation codes each new user receives upon registration."
        >
          <div class="flex items-center gap-3">
            <input
              v-model.number="defaultInvites"
              type="number"
              min="0"
              max="100"
              class="w-full md:w-32 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono"
              placeholder="2"
            />
          </div>
        </SettingsGroup>

        <!-- Minimum Ratio -->
        <SettingsGroup
          label="Minimum Ratio"
          description="Users with a ratio below this value will be blocked from downloading. Set to 0 to disable."
        >
          <div class="flex items-center gap-3">
            <input
              v-model.number="minRatio"
              type="number"
              step="0.1"
              min="0"
              class="w-full md:w-32 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono"
              placeholder="0.00"
            />
            <span
              class="text-xs text-text-muted font-mono"
              v-if="minRatio <= 0"
            >
              (Disabled)
            </span>
          </div>
        </SettingsGroup>

        <!-- Starter Credit -->
        <SettingsGroup
          label="Starter Credit (GB)"
          description="Initial upload amount given to new users to prevent immediate ratio blocking."
        >
          <div class="flex items-center gap-3">
            <input
              v-model.number="starterUploadGB"
              type="number"
              min="0"
              class="w-full md:w-32 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono"
              placeholder="0"
            />
            <span class="text-xs text-text-muted">GB</span>
          </div>
        </SettingsGroup>
      </div>

      <button
        @click="saveSettings"
        :disabled="settingsLoading || saved"
        class="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        :class="
          saved
            ? 'bg-success text-white'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon
          v-if="settingsLoading"
          name="ph:circle-notch"
          class="animate-spin"
        />
        <Icon v-else-if="saved" name="ph:check-bold" />
        {{
          settingsLoading ? 'Saving...' : saved ? 'Saved' : 'Save Configuration'
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const registrationOpen = ref(false);
const inviteEnabled = ref(false);
const defaultInvites = ref(2);
const minRatio = ref(0);
const starterUploadGB = ref(0);
const settingsLoading = ref(false);
const saved = ref(false);

// Fetch settings on mount
onMounted(async () => {
  try {
    const settings = await $fetch<{
      registrationOpen: boolean;
      inviteEnabled: boolean;
      defaultInvites: number;
      minRatio: number;
      starterUpload: number;
    }>('/api/admin/settings');
    registrationOpen.value = settings.registrationOpen;
    inviteEnabled.value = settings.inviteEnabled;
    defaultInvites.value = settings.defaultInvites;
    minRatio.value = settings.minRatio;
    starterUploadGB.value = Math.floor(settings.starterUpload / 1024 ** 3);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
});

function getStatusClass() {
  if (registrationOpen && !inviteEnabled)
    return 'bg-success/10 border-success/20';
  if (inviteEnabled) return 'bg-accent/10 border-accent/20';
  return 'bg-bg-tertiary border-border';
}

function getStatusIcon() {
  if (registrationOpen && !inviteEnabled) return 'ph:lock-open';
  if (inviteEnabled) return 'ph:envelope-simple';
  return 'ph:lock-simple';
}

function getStatusIconClass() {
  if (registrationOpen && !inviteEnabled) return 'text-success';
  if (inviteEnabled) return 'text-accent';
  return 'text-text-muted';
}

function getStatusTextClass() {
  if (registrationOpen && !inviteEnabled) return 'text-success';
  if (inviteEnabled) return 'text-accent';
  return 'text-text-secondary';
}

function getStatusText() {
  if (registrationOpen && !inviteEnabled)
    return 'Registration is open to everyone';
  if (registrationOpen && inviteEnabled)
    return 'Registration open (invite optional)';
  if (!registrationOpen && inviteEnabled) return 'Invite-only registration';
  return 'Registration is closed';
}

async function toggleRegistration() {
  settingsLoading.value = true;
  try {
    const newValue = !registrationOpen.value;
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { registrationOpen: newValue },
    });
    registrationOpen.value = newValue;
  } catch (error) {
    console.error('Failed to update settings:', error);
  } finally {
    settingsLoading.value = false;
  }
}

async function toggleInviteEnabled() {
  settingsLoading.value = true;
  try {
    const newValue = !inviteEnabled.value;
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { inviteEnabled: newValue },
    });
    inviteEnabled.value = newValue;
  } catch (error) {
    console.error('Failed to update settings:', error);
  } finally {
    settingsLoading.value = false;
  }
}

async function saveSettings() {
  settingsLoading.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        minRatio: minRatio.value,
        starterUpload: starterUploadGB.value * 1024 ** 3,
        defaultInvites: defaultInvites.value,
      },
    });
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save settings:', error);
  } finally {
    settingsLoading.value = false;
  }
}
</script>
