<template>
  <AuthShell>
    <div class="bg-bg-secondary border border-border rounded-lg p-6">
      <h2 class="text-lg font-semibold mb-2">{{ t('safeguards.appeal.title') }}</h2>
      <p class="text-text-muted text-sm mb-6">{{ t('safeguards.appeal.intro') }}</p>

      <div v-if="!status" class="text-text-muted text-sm flex items-center gap-2">
        <Icon name="ph:spinner" class="animate-spin" />
        {{ t('safeguards.appeal.loading') }}
      </div>

      <template v-else>
        <!-- Latest appeal -->
        <div v-if="latest" class="p-3 rounded border text-sm mb-6 space-y-2" :class="statusClass(latest.status)">
          <p class="flex items-center gap-2 font-medium">
            <Icon :name="latest.status === 'pending' ? 'ph:hourglass' : 'ph:x-circle'" />
            {{ t(`safeguards.appeal.status.${latest.status}`) }}
          </p>
          <p class="text-xs text-text-muted whitespace-pre-wrap break-words">{{ latest.message }}</p>
          <p v-if="latest.staffNote" class="text-xs">
            {{ t('safeguards.appeal.staffNote', { note: latest.staffNote }) }}
          </p>
        </div>

        <!-- New appeal -->
        <form v-if="canAppeal" class="space-y-3" @submit.prevent="submit">
          <label class="block">
            <span class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              {{ t('safeguards.appeal.message') }}
            </span>
            <textarea
              v-model="message"
              rows="5"
              :maxlength="APPEAL_MAX_LENGTH"
              :placeholder="t('safeguards.appeal.placeholder')"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <p class="text-xs text-text-muted">
            {{ t('safeguards.appeal.length', { count: message.trim().length, max: APPEAL_MAX_LENGTH }) }}
          </p>
          <button
            type="submit"
            :disabled="busy || message.trim().length < APPEAL_MIN_LENGTH"
            class="w-full bg-white text-black font-medium py-2.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Icon v-if="busy" name="ph:spinner" class="animate-spin" />
            {{ t('safeguards.appeal.submit') }}
          </button>
        </form>

        <div v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</div>

        <div class="mt-6 pt-6 border-t border-border space-y-3">
          <button
            type="button"
            :disabled="busy"
            class="w-full border border-border text-sm py-2 rounded hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            @click="refresh"
          >
            {{ t('safeguards.appeal.check') }}
          </button>
          <button type="button" class="w-full text-xs text-text-muted hover:text-text-primary" @click="logout">
            {{ t('safeguards.appeal.logout') }}
          </button>
        </div>
      </template>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { APPEAL_MAX_LENGTH, APPEAL_MIN_LENGTH, canFileAppeal } from '~~/shared/utils/multiAccount';

definePageMeta({
  layout: false,
});

interface Appeal {
  id: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  staffNote: string | null;
  createdAt: string;
}

const { t } = useI18n();
const router = useRouter();
const { clear, fetch: fetchSession } = useUserSession();

const status = ref<{ held: boolean; appeals: Appeal[] } | null>(null);
const message = ref('');
const busy = ref(false);
const error = ref('');

const latest = computed(() => status.value?.appeals[0] ?? null);
const canAppeal = computed(() => canFileAppeal(latest.value));

async function load() {
  status.value = await $fetch<{ held: boolean; appeals: Appeal[] }>('/api/auth/appeal');
  if (!status.value.held) {
    // Approved: the session carries the new state, the middleware lets the user in
    await fetchSession();
    await router.push('/');
  }
}

async function refresh() {
  busy.value = true;
  error.value = '';
  try {
    await load();
  } catch {
    error.value = t('safeguards.error');
  } finally {
    busy.value = false;
  }
}

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await $fetch('/api/auth/appeal', { method: 'POST', body: { message: message.value.trim() } });
    message.value = '';
    await load();
  } catch (err) {
    error.value = (err as { data?: { message?: string } }).data?.message ?? t('safeguards.error');
  } finally {
    busy.value = false;
  }
}

function statusClass(s: Appeal['status']) {
  return s === 'pending'
    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    : 'bg-error/10 border-error/30 text-error';
}

async function logout() {
  await clear();
  await router.push('/auth/login');
}

onMounted(() => {
  void refresh();
});
</script>
