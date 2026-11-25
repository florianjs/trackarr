<template>
  <div class="card mb-6">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:shield-bold" class="text-text-muted" aria-hidden="true" />
        <h2 class="text-sm font-bold text-text-primary">{{ t('users.moderation.title') }}</h2>
      </div>
      <Icon v-if="pending" name="ph:circle-notch" class="animate-spin text-text-muted" />
    </div>

    <div v-if="state" class="card-body space-y-4">
      <!-- Account state -->
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span v-for="chip in chips" :key="chip.key" class="px-2 py-0.5 rounded-sm border" :class="chip.class" :title="chip.title">
          {{ chip.label }}
        </span>
        <span v-if="state.lastIp" class="num text-text-muted">IP {{ state.lastIp }}</span>
        <span v-if="state.bonusPoints !== null" class="num text-text-muted">
          {{ t('users.moderation.bonus.points', { points: Math.floor(state.bonusPoints) }) }}
        </span>
        <span v-if="state.invitesRemaining !== null" class="num text-text-muted">
          {{ t('users.moderation.edit.invitesLeft', { count: state.invitesRemaining }) }}
        </span>
      </div>

      <p v-if="noAction" class="text-xs text-text-muted">{{ t('users.moderation.staffOnly') }}</p>

      <!-- Actions -->
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          class="btn text-xs"
          :class="[open === action.key ? 'btn-primary' : 'btn-secondary', action.danger && open !== action.key ? '!text-danger' : '']"
          :aria-expanded="open === action.key"
          @click="toggle(action.key)"
        >
          <Icon :name="action.icon" aria-hidden="true" />{{ action.label }}
        </button>
      </div>

      <!-- Ban -->
      <form v-if="open === 'ban'" class="panel space-y-3" @submit.prevent="run('ban')">
        <p class="text-xs text-text-muted">{{ t('users.moderation.ban.hint') }}</p>
        <input
          v-model="form.banReason"
          type="text"
          maxlength="500"
          required
          class="input w-full text-xs"
          :placeholder="t('users.moderation.reasonPlaceholder')"
          :aria-label="t('users.moderation.reason')"
        />
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary text-xs" :disabled="busy || !form.banReason.trim()">
            {{ t('users.moderation.ban.confirm', { name: username }) }}
          </button>
        </div>
      </form>

      <!-- Mute -->
      <form v-if="open === 'mute'" class="panel" @submit.prevent="run('mute')">
        <div class="flex flex-wrap gap-2">
          <select v-model.number="form.muteMinutes" class="input text-xs w-auto" :aria-label="t('users.moderation.mute.duration')">
            <option v-for="d in muteDurations" :key="d.minutes" :value="d.minutes">{{ d.label }}</option>
          </select>
          <input
            v-model="form.muteReason"
            type="text"
            maxlength="200"
            class="input text-xs flex-1 min-w-48"
            :placeholder="t('users.moderation.reasonOptional')"
            :aria-label="t('users.moderation.reason')"
          />
          <button type="submit" class="btn btn-primary text-xs" :disabled="busy">
            {{ t('users.moderation.mute.confirm') }}
          </button>
        </div>
      </form>

      <!-- Hold -->
      <div v-if="open === 'hold'" class="panel space-y-3">
        <p class="text-xs text-text-muted">{{ t('users.moderation.hold.hint') }}</p>
        <blockquote v-if="state.appeal" class="text-xs text-text-secondary border-l-2 border-border pl-3 whitespace-pre-line">
          {{ state.appeal.message }}
        </blockquote>
        <p v-else class="text-xs text-text-muted">{{ t('users.moderation.hold.noAppeal') }}</p>
        <div class="flex justify-end">
          <button type="button" class="btn btn-primary text-xs" :disabled="busy" @click="run('hold')">
            {{ t('users.moderation.hold.confirm') }}
          </button>
        </div>
      </div>

      <!-- Simple confirmations -->
      <div v-if="open && confirmOnly.includes(open)" class="panel space-y-3">
        <p class="text-xs text-text-muted">{{ t(`users.moderation.${open}.hint`, { name: username }) }}</p>
        <div class="flex justify-end">
          <button type="button" class="btn btn-primary text-xs" :disabled="busy" @click="run(open)">
            {{ t(`users.moderation.${open}.confirm`) }}
          </button>
        </div>
      </div>

      <!-- Edit -->
      <form v-if="open === 'edit'" class="panel grid gap-3 sm:grid-cols-[1fr_10rem_auto] items-end" @submit.prevent="run('edit')">
        <label class="space-y-1">
          <span class="text-xs font-bold text-text-muted">{{ t('users.moderation.edit.username') }}</span>
          <input v-model="form.username" type="text" maxlength="20" class="input w-full text-xs" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-bold text-text-muted">{{ t('users.moderation.edit.invites') }}</span>
          <input v-model.number="form.invites" type="number" min="0" max="1000" class="input w-full text-xs num" />
        </label>
        <button type="submit" class="btn btn-primary text-xs" :disabled="busy || !editChanged">
          {{ t('common.save') }}
        </button>
      </form>

      <!-- Roles -->
      <div v-if="open === 'roles'" class="panel flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 text-xs text-text-secondary">
          <input v-model="form.isModerator" type="checkbox" />{{ t('users.moderation.roles.moderator') }}
        </label>
        <label class="flex items-center gap-2 text-xs text-text-secondary">
          <input v-model="form.isAdmin" type="checkbox" />{{ t('common.admin') }}
        </label>
        <label v-if="roles.length" class="flex items-center gap-2 text-xs text-text-secondary">
          {{ t('common.role') }}
          <select v-model="form.roleId" class="input text-xs w-auto">
            <option value="">{{ t('admin.users.noRole') }}</option>
            <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary text-xs ml-auto" :disabled="busy || !rolesChanged" @click="run('roles')">
          {{ t('common.save') }}
        </button>
      </div>

      <!-- Ratio -->
      <div v-if="open === 'ratio'" class="-mx-4 -mb-4">
        <AdminUserStats :user-id="userId" :username="username" @changed="emit('changed')" />
      </div>

      <!-- Bonus -->
      <form v-if="open === 'bonus'" class="panel flex flex-wrap gap-2" @submit.prevent="run('bonus')">
        <input
          v-model.number="form.bonusAmount"
          type="number"
          step="1"
          class="input text-xs w-32 num"
          :aria-label="t('users.moderation.bonus.amount')"
          :placeholder="t('users.moderation.bonus.amount')"
        />
        <input
          v-model="form.bonusReason"
          type="text"
          maxlength="200"
          class="input text-xs flex-1 min-w-48"
          :placeholder="t('users.moderation.reasonPlaceholder')"
          :aria-label="t('users.moderation.reason')"
        />
        <button
          type="submit"
          class="btn btn-primary text-xs"
          :disabled="busy || !Number.isInteger(form.bonusAmount) || form.bonusAmount === 0 || !form.bonusReason.trim()"
        >
          {{ t('users.moderation.bonus.confirm') }}
        </button>
      </form>

      <!-- Delete -->
      <form v-if="open === 'delete'" class="panel space-y-3" @submit.prevent="run('delete')">
        <p class="text-xs text-text-muted">{{ t('users.moderation.delete.hint') }}</p>
        <input
          v-model="form.deleteConfirm"
          type="text"
          class="input w-full text-xs"
          autocomplete="off"
          :placeholder="t('users.moderation.delete.typeName', { name: username })"
          :aria-label="t('users.moderation.delete.typeName', { name: username })"
        />
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary !bg-danger !text-white text-xs" :disabled="busy || form.deleteConfirm !== username">
            {{ t('users.moderation.delete.confirm') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModerationRights } from '~~/shared/utils/userModeration';
import { formatDate } from '~/utils/format';

interface ModerationState {
  id: string;
  username: string;
  isAdmin: boolean;
  isModerator: boolean;
  isBanned: boolean;
  isDeleted: boolean;
  paymentPending: boolean;
  ipHold: boolean;
  ipExempt: boolean;
  roleId: string | null;
  hasAvatar: boolean;
  mute: { until: string; reason: string | null } | null;
  appeal: { message: string; createdAt: string } | null;
  lastIp: string | null;
  bonusPoints: number | null;
  invitesRemaining: number | null;
  rights: ModerationRights;
}

interface Role {
  id: string;
  name: string;
}

type ActionKey =
  | 'ban'
  | 'unban'
  | 'mute'
  | 'unmute'
  | 'hold'
  | 'avatar'
  | 'sessions'
  | 'edit'
  | 'roles'
  | 'ratio'
  | 'bonus'
  | 'passkey'
  | 'delete';

const props = defineProps<{ userId: string; username: string }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const notifications = useNotificationStore();

const { data: state, pending, refresh } = await useFetch<ModerationState>(() => `/api/mod/users/${props.userId}`, {
  lazy: true,
});

const roles = ref<Role[]>([]);
watch(
  () => state.value?.rights.edit,
  async (canEdit) => {
    if (!canEdit || roles.value.length) return;
    try {
      roles.value = await $fetch<Role[]>('/api/admin/roles');
    } catch {
      // Custom roles are optional: the select stays hidden
    }
  },
  { immediate: true }
);

// Actions that only need a confirm button
const confirmOnly: ActionKey[] = ['unban', 'unmute', 'avatar', 'sessions', 'passkey'];

const open = ref<ActionKey | null>(null);
const busy = ref(false);

const form = reactive({
  banReason: '',
  muteMinutes: 60 * 24,
  muteReason: '',
  username: '',
  invites: 0,
  isAdmin: false,
  isModerator: false,
  roleId: '',
  bonusAmount: 0,
  bonusReason: '',
  deleteConfirm: '',
});

function resetForm() {
  const s = state.value;
  Object.assign(form, {
    banReason: '',
    muteReason: '',
    username: s?.username ?? props.username,
    invites: s?.invitesRemaining ?? 0,
    isAdmin: s?.isAdmin ?? false,
    isModerator: s?.isModerator ?? false,
    roleId: s?.roleId ?? '',
    bonusAmount: 0,
    bonusReason: '',
    deleteConfirm: '',
  });
}

function toggle(key: ActionKey) {
  open.value = open.value === key ? null : key;
  resetForm();
}

const muteDurations = computed(() => [
  { minutes: 60, label: t('users.moderation.mute.hour') },
  { minutes: 60 * 24, label: t('users.moderation.mute.day') },
  { minutes: 60 * 24 * 7, label: t('users.moderation.mute.week') },
  { minutes: 60 * 24 * 30, label: t('users.moderation.mute.month') },
]);

const editChanged = computed(
  () => !!state.value && (form.username.trim() !== state.value.username || form.invites !== state.value.invitesRemaining)
);
const rolesChanged = computed(
  () =>
    !!state.value &&
    (form.isAdmin !== state.value.isAdmin ||
      form.isModerator !== state.value.isModerator ||
      form.roleId !== (state.value.roleId ?? ''))
);

const chips = computed(() => {
  const s = state.value;
  if (!s) return [];
  const danger = 'border-danger/40 text-danger';
  const warn = 'border-leech/40 text-leech';
  const list: { key: string; label: string; class: string; title?: string }[] = [];
  if (s.isDeleted) list.push({ key: 'deleted', label: t('users.moderation.status.deleted'), class: danger });
  else if (s.isBanned) list.push({ key: 'banned', label: t('users.moderation.status.banned'), class: danger });
  if (s.mute) {
    list.push({
      key: 'muted',
      label: t('users.moderation.status.muted', { until: formatDate(s.mute.until) }),
      class: warn,
      title: s.mute.reason ?? undefined,
    });
  }
  if (s.ipHold) list.push({ key: 'hold', label: t('users.moderation.status.hold'), class: warn });
  if (s.paymentPending) list.push({ key: 'payment', label: t('users.moderation.status.payment'), class: warn });
  if (!list.length) list.push({ key: 'ok', label: t('users.moderation.status.active'), class: 'border-seed/40 text-seed' });
  return list;
});

const actions = computed(() => {
  const s = state.value;
  if (!s || s.isDeleted) return [];
  const r = s.rights;
  const list: { key: ActionKey; label: string; icon: string; danger?: boolean }[] = [];
  const add = (show: boolean, key: ActionKey, icon: string, danger = false) => {
    if (show) list.push({ key, icon, danger, label: t(`users.moderation.${key}.action`) });
  };
  add(r.ban && !s.isBanned, 'ban', 'ph:prohibit', true);
  add(r.ban && s.isBanned, 'unban', 'ph:arrow-counter-clockwise');
  add(r.mute && !s.mute, 'mute', 'ph:speaker-slash');
  add(r.mute && !!s.mute, 'unmute', 'ph:speaker-high');
  add(r.moderate && s.ipHold, 'hold', 'ph:lock-open');
  add(r.moderate && s.hasAvatar, 'avatar', 'ph:image-broken');
  add(r.moderate, 'sessions', 'ph:sign-out');
  add(r.edit, 'edit', 'ph:pencil-simple');
  add(r.edit, 'roles', 'ph:user-gear');
  add(r.edit, 'ratio', 'ph:scales');
  add(r.edit, 'bonus', 'ph:coins');
  add(r.edit, 'passkey', 'ph:key');
  add(r.delete, 'delete', 'ph:trash', true);
  return list;
});

const noAction = computed(() => !!state.value && !state.value.isDeleted && actions.value.length === 0);

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Plain string URL: typed Nitro routes blow the type checker stack here
function call(url: string, method: Method, body?: Record<string, unknown>): Promise<unknown> {
  return $fetch<unknown, string>(url, { method, body });
}

function request(key: ActionKey): Promise<unknown> {
  const id = props.userId;
  switch (key) {
    case 'ban':
      return call(`/api/admin/users/${id}/ban`, 'POST', { reason: form.banReason.trim() });
    case 'unban':
      return call(`/api/admin/users/${id}/unban`, 'POST');
    case 'mute':
      return call('/api/mod/shoutbox/mutes', 'POST', { userId: id, minutes: form.muteMinutes, reason: form.muteReason.trim() || undefined });
    case 'unmute':
      return call(`/api/mod/shoutbox/mutes/${id}`, 'DELETE');
    case 'hold':
      return call(`/api/mod/appeals/${id}`, 'POST', { decision: 'approve' });
    case 'avatar':
      return call(`/api/mod/users/${id}/avatar`, 'DELETE');
    case 'sessions':
      return call(`/api/mod/users/${id}/sessions`, 'DELETE');
    case 'edit': {
      const s = state.value!;
      const name = form.username.trim();
      return call(`/api/admin/users/${id}`, 'PATCH', {
        ...(name !== s.username && { username: name }),
        ...(form.invites !== s.invitesRemaining && { invitesRemaining: form.invites }),
      });
    }
    case 'roles':
      return saveRoles();
    case 'bonus':
      return call(`/api/admin/users/${id}/bonus`, 'POST', { amount: form.bonusAmount, reason: form.bonusReason.trim() });
    case 'passkey':
      return call(`/api/admin/users/${id}/passkey`, 'POST');
    case 'delete':
      return call(`/api/admin/users/${id}`, 'DELETE');
    case 'ratio':
      return Promise.resolve();
  }
}

async function saveRoles() {
  // Snapshot first: the form may be reset by another panel during the requests
  const s = state.value!;
  const wanted = { isAdmin: form.isAdmin, isModerator: form.isModerator, roleId: form.roleId };
  if (wanted.isAdmin !== s.isAdmin || wanted.isModerator !== s.isModerator) {
    await call(`/api/admin/users/${props.userId}/role`, 'PUT', { isAdmin: wanted.isAdmin, isModerator: wanted.isModerator });
  }
  if (wanted.roleId !== (s.roleId ?? '')) {
    await call(`/api/admin/users/${props.userId}/assign-role`, 'PUT', { roleId: wanted.roleId || null });
  }
}

// Actions that change what the public profile shows
const profileChanging: ActionKey[] = ['edit', 'roles', 'avatar', 'delete'];

async function run(key: ActionKey) {
  if (busy.value) return;
  busy.value = true;
  try {
    await request(key);
    notifications.success(t(`users.moderation.${key}.done`, { name: props.username }));
    open.value = null;
    await refresh();
    if (profileChanging.includes(key)) emit('changed');
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message;
    notifications.error(t('users.moderation.failed'), message);
    // Multi-request actions (roles) may have half applied: show what is stored
    await refresh().catch(() => {});
    if (profileChanging.includes(key)) emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.panel {
  @apply rounded border border-border bg-bg-tertiary/40 p-3;
}
</style>
