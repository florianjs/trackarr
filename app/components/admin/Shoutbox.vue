<template>
  <div class="space-y-6">
    <div v-if="message" class="text-xs px-3 py-2 rounded border" :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'">
      {{ message.text }}
    </div>

    <!-- On / off -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-sm font-medium text-text-primary">{{ t('shoutbox.admin.settings') }}</h3>
      </div>
      <div v-if="settings" class="card-body space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="settings.enabled" type="checkbox" :disabled="saving" @change="saveSettings" />
          {{ t('shoutbox.admin.enabled') }}
        </label>
        <p class="text-xs text-text-muted">{{ t('shoutbox.admin.enabledHint') }}</p>
      </div>
    </div>

    <!-- Channels -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="text-sm font-medium text-text-primary">{{ t('shoutbox.admin.channels') }}</h3>
        <button class="btn btn-secondary !py-1.5 !px-3 text-xs" @click="edit()">
          <Icon name="ph:plus-bold" class="mr-1" />{{ t('shoutbox.admin.addChannel') }}
        </button>
      </div>
      <div class="card-body space-y-3">
        <!-- Editor -->
        <form v-if="draft" class="p-4 rounded border border-border bg-bg-tertiary/50 space-y-3" @submit.prevent="saveChannel">
          <p class="text-xs font-bold text-text-muted">
            {{ draft.id ? t('shoutbox.admin.editChannel') : t('shoutbox.admin.addChannel') }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.name') }}</span>
              <input v-model="draft.name" type="text" maxlength="40" required class="input w-full !py-2 text-xs" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.position') }}</span>
              <input v-model.number="draft.position" type="number" min="0" max="1000" class="input w-full !py-2 text-xs font-mono" />
            </label>
            <label class="space-y-1 sm:col-span-2">
              <span class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.description') }}</span>
              <input v-model="draft.description" type="text" maxlength="200" class="input w-full !py-2 text-xs" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.readAccess') }}</span>
              <select v-model="draft.readAccess" class="input w-full !py-2 text-xs">
                <option v-for="a in READ_ACCESS" :key="a" :value="a">{{ t(`shoutbox.admin.read.${a}`) }}</option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.writeAccess') }}</span>
              <select v-model="draft.writeAccess" class="input w-full !py-2 text-xs">
                <option v-for="a in WRITE_ACCESS" :key="a" :value="a">{{ t(`shoutbox.admin.write.${a}`) }}</option>
              </select>
            </label>
          </div>

          <fieldset v-if="draft.readAccess === 'roles'" class="space-y-1">
            <legend class="text-xs font-bold text-text-muted">{{ t('shoutbox.admin.roles') }}</legend>
            <p v-if="!roles.length" class="text-xs text-text-muted">{{ t('shoutbox.admin.noRoles') }}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <label v-for="role in roles" :key="role.id" class="flex items-center gap-1.5 text-xs">
                <input v-model="draft.roleIds" type="checkbox" :value="role.id" />
                <span :style="{ color: role.color }">{{ role.name }}</span>
              </label>
            </div>
            <p class="text-xs text-text-muted">{{ t('shoutbox.admin.rolesHint') }}</p>
          </fieldset>

          <label class="flex items-center gap-2 text-xs">
            <input v-model="draft.reactionsEnabled" type="checkbox" />
            {{ t('shoutbox.admin.reactions') }}
          </label>

          <div class="flex gap-2">
            <button type="submit" class="btn btn-primary !py-2 text-xs" :disabled="saving">{{ t('shoutbox.admin.save') }}</button>
            <button type="button" class="btn btn-ghost !py-2 text-xs" @click="draft = null">{{ t('shoutbox.cancel') }}</button>
          </div>
        </form>

        <!-- List -->
        <table v-if="channels.length" class="data-table">
          <thead>
            <tr>
              <th>{{ t('shoutbox.admin.name') }}</th>
              <th>{{ t('shoutbox.admin.readAccess') }}</th>
              <th>{{ t('shoutbox.admin.writeAccess') }}</th>
              <th class="text-right">{{ t('shoutbox.admin.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in channels" :key="c.id">
              <td>
                <span class="text-sm text-text-primary">{{ c.name }}</span>
                <span v-if="c.description" class="block text-xs text-text-muted">{{ c.description }}</span>
              </td>
              <td class="text-xs text-text-secondary">
                {{ t(`shoutbox.admin.read.${c.readAccess}`) }}
                <span v-if="c.readAccess === 'roles'" class="block text-text-muted">{{ roleNames(c.roleIds) }}</span>
              </td>
              <td class="text-xs text-text-secondary">{{ t(`shoutbox.admin.write.${c.writeAccess}`) }}</td>
              <td class="text-right whitespace-nowrap">
                <button class="p-1.5 rounded btn-ghost" :title="t('shoutbox.admin.editChannel')" :aria-label="t('shoutbox.admin.editChannel')" @click="edit(c)">
                  <Icon name="ph:pencil-simple" class="block" />
                </button>
                <button
                  v-if="confirmDelete !== c.id"
                  class="p-1.5 rounded btn-ghost"
                  :title="t('shoutbox.admin.deleteChannel')"
                  :aria-label="t('shoutbox.admin.deleteChannel')"
                  @click="confirmDelete = c.id"
                >
                  <Icon name="ph:trash" class="block" />
                </button>
                <button v-else class="btn !py-1 !px-2 text-xs bg-error/10 text-error hover:bg-error/20 border border-error/30" @click="removeChannel(c.id)">
                  {{ t('shoutbox.admin.confirmDelete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-text-muted">{{ t('shoutbox.admin.noChannels') }}</p>
      </div>
    </div>

    <AdminShoutboxMutes />
  </div>
</template>

<script setup lang="ts">
const READ_ACCESS = ['all', 'roles', 'staff'] as const;
const WRITE_ACCESS = ['members', 'staff', 'admins'] as const;

interface Channel {
  id: string;
  name: string;
  description: string | null;
  position: number;
  readAccess: (typeof READ_ACCESS)[number];
  roleIds: string[];
  writeAccess: (typeof WRITE_ACCESS)[number];
  reactionsEnabled: boolean;
}
type Draft = Omit<Channel, 'id' | 'description'> & { id?: string; description: string };

const { t } = useI18n();

const { data: settings } = await useFetch<{ enabled: boolean }>('/api/admin/shoutbox/settings');
const { data: channels, refresh } = await useFetch<Channel[]>('/api/admin/shoutbox/channels', { default: () => [] });
const { data: roles } = await useFetch<Array<{ id: string; name: string; color: string }>>('/api/admin/roles', {
  default: () => [],
});

const saving = ref(false);
const message = ref<{ ok: boolean; text: string } | null>(null);
const draft = ref<Draft | null>(null);
const confirmDelete = ref<string | null>(null);

async function run(fn: () => Promise<unknown>) {
  saving.value = true;
  message.value = null;
  try {
    await fn();
    message.value = { ok: true, text: t('shoutbox.admin.saved') };
  } catch (err) {
    message.value = { ok: false, text: (err as { data?: { message?: string } }).data?.message ?? t('shoutbox.error') };
  } finally {
    saving.value = false;
  }
}

function saveSettings() {
  if (!settings.value) return;
  const enabled = settings.value.enabled;
  return run(async () => {
    try {
      settings.value = await $fetch<{ enabled: boolean }>('/api/admin/shoutbox/settings', {
        method: 'PUT',
        body: { enabled },
      });
    } catch (err) {
      // The checkbox already flipped: put it back to what is saved
      if (settings.value) settings.value.enabled = !enabled;
      throw err;
    }
  });
}

function edit(channel?: Channel) {
  confirmDelete.value = null;
  draft.value = channel
    ? { ...channel, roleIds: [...channel.roleIds], description: channel.description ?? '' }
    : {
        name: '',
        description: '',
        position: channels.value.length,
        readAccess: 'all',
        roleIds: [],
        writeAccess: 'members',
        reactionsEnabled: true,
      };
}

function saveChannel() {
  const value = draft.value;
  if (!value) return;
  const { id, ...body } = value;
  return run(async () => {
    await $fetch(id ? `/api/admin/shoutbox/channels/${id}` : '/api/admin/shoutbox/channels', {
      method: id ? 'PUT' : 'POST',
      body: { ...body, description: body.description || null },
    });
    draft.value = null;
    await refresh();
  });
}

function removeChannel(id: string) {
  return run(async () => {
    await $fetch(`/api/admin/shoutbox/channels/${id}`, { method: 'DELETE' });
    confirmDelete.value = null;
    await refresh();
  });
}

function roleNames(ids: string[]): string {
  return ids
    .map((id) => roles.value.find((r) => r.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}
</script>
