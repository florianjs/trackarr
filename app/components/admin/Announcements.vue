<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:megaphone" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Site Announcement
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Enable Toggle -->
      <SettingsGroup
        label="Enable Announcement"
        description="Display a banner below the main navigation bar on all pages."
      >
        <div class="flex items-center gap-3">
          <button
            @click="enabled = !enabled"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20',
              enabled ? 'bg-success' : 'bg-bg-tertiary border border-border',
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                enabled ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
          <span class="text-xs text-text-muted">
            {{ enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
      </SettingsGroup>

      <!-- Message -->
      <SettingsGroup
        label="Message"
        description="The content of the announcement. Keep it short and clear."
      >
        <div class="relative">
          <textarea
            v-model="message"
            rows="3"
            maxlength="500"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 resize-none"
            placeholder="Enter your announcement message..."
          />
          <p
            class="text-[10px] text-text-muted mt-1.5 text-right absolute bottom-2 right-2"
          >
            {{ message.length }}/500
          </p>
        </div>
      </SettingsGroup>

      <!-- Type Selector -->
      <SettingsGroup
        label="Banner Type"
        description="Determines the color and icon of the announcement banner."
      >
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            @click="type = option.value"
            :class="[
              'flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs font-medium transition-colors',
              type === option.value
                ? 'border-white bg-white/5 text-text-primary'
                : 'border-border text-text-muted hover:border-white/20',
            ]"
          >
            <Icon :name="option.icon" />
            {{ option.label }}
          </button>
        </div>
      </SettingsGroup>

      <!-- Preview -->
      <div v-if="enabled && message" class="pt-6 border-t border-border/50">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4"
        >
          Live Preview
        </p>
        <div
          :class="[
            'px-4 py-3 rounded-lg border flex items-center gap-3',
            typeStyles[type].bg,
            typeStyles[type].border,
          ]"
        >
          <Icon
            :name="typeStyles[type].icon"
            :class="['text-lg', typeStyles[type].text]"
          />
          <p :class="['text-sm flex-1', typeStyles[type].text]">
            {{ message }}
          </p>
          <Icon
            name="ph:x"
            class="text-text-muted hover:text-text-primary cursor-pointer"
          />
        </div>
      </div>

      <!-- Save Button -->
      <button
        @click="saveAnnouncement"
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
        {{ loading ? 'Saving...' : saved ? 'Saved' : 'Save Announcement' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const enabled = ref(false);
const message = ref('');
const type = ref<'info' | 'warning' | 'error'>('info');
const loading = ref(false);
const saved = ref(false);

const typeOptions = [
  { value: 'info' as const, label: 'Info', icon: 'ph:info' },
  { value: 'warning' as const, label: 'Warning', icon: 'ph:warning' },
  { value: 'error' as const, label: 'Error', icon: 'ph:warning-circle' },
];

const typeStyles = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: 'ph:info',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: 'ph:warning',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: 'ph:warning-circle',
  },
};

onMounted(async () => {
  try {
    const settings = await $fetch<{
      announcementEnabled: boolean;
      announcementMessage: string;
      announcementType: 'info' | 'warning' | 'error';
    }>('/api/admin/settings');
    enabled.value = settings.announcementEnabled;
    message.value = settings.announcementMessage || '';
    type.value = settings.announcementType || 'info';
  } catch (error) {
    console.error('Failed to load announcement settings:', error);
  }
});

async function saveAnnouncement() {
  loading.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        announcementEnabled: enabled.value,
        announcementMessage: message.value,
        announcementType: type.value,
      },
    });
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save announcement:', error);
  } finally {
    loading.value = false;
  }
}
</script>
