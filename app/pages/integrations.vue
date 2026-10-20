<template>
  <div>
    <div class="mb-6">
      <h2 class="text-2xl font-semibold tracking-tight text-text-primary">
        {{ t('integrations.title') }}
      </h2>
      <p class="text-sm text-text-muted mt-0.5">
        {{ t('integrations.subtitle') }}
      </p>
    </div>

    <div class="card mb-6">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:plugs-connected-bold" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">
            {{ t('integrations.credentials') }}
          </h3>
        </div>
      </div>
      <div class="card-body space-y-4">
        <p class="text-sm text-text-muted">{{ t('integrations.credentialsHint') }}</p>

        <div v-for="field in fields" :key="field.key">
          <label :for="`field-${field.key}`" class="block text-xs text-text-muted mb-1">
            {{ field.label }}
          </label>
          <div class="flex items-center gap-2">
            <input
              :id="`field-${field.key}`"
              :value="field.display"
              readonly
              class="flex-1 min-w-0 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm font-mono text-text-primary"
            />
            <button
              v-if="field.key === 'apiKey'"
              type="button"
              class="p-2 btn-ghost rounded shrink-0"
              :title="revealed ? t('integrations.hide') : t('integrations.show')"
              :aria-label="revealed ? t('integrations.hide') : t('integrations.show')"
              :disabled="!apiKey"
              @click="revealed = !revealed"
            >
              <Icon :name="revealed ? 'ph:eye-slash' : 'ph:eye'" class="block text-text-muted" />
            </button>
            <button
              type="button"
              class="p-2 btn-ghost rounded shrink-0"
              :title="copiedKey === field.key ? t('integrations.copied') : t('integrations.copy')"
              :aria-label="t('integrations.copy')"
              :disabled="!field.value"
              @click="copy(field.key, field.value)"
            >
              <Icon :name="copiedKey === field.key ? 'ph:check' : 'ph:copy'" class="block text-text-muted" />
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" class="btn btn-primary" :disabled="!apiKey || testing" @click="testConnection">
            <Icon :name="testing ? 'ph:circle-notch' : 'ph:pulse'" class="mr-2" :class="{ 'animate-spin': testing }" />
            {{ testing ? t('integrations.testing') : t('integrations.test') }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="!apiKey || rotating" @click="rotateKey">
            <Icon name="ph:arrows-clockwise" class="mr-2" :class="{ 'animate-spin': rotating }" />
            {{ t('integrations.rotate') }}
          </button>
          <p
            v-if="testResult"
            role="status"
            class="flex items-center gap-1.5 text-sm"
            :class="testResult.ok ? 'text-success' : 'text-danger'"
          >
            <Icon :name="testResult.ok ? 'ph:check-circle' : 'ph:warning-circle'" />
            {{ testResult.ok ? t('integrations.testOk') : t('integrations.testFailed', { reason: testResult.description }) }}
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="flex gap-1" role="tablist">
          <button
            v-for="app in apps"
            :key="app"
            type="button"
            role="tab"
            :aria-selected="selected === app"
            class="px-3 py-1.5 text-sm rounded"
            :class="selected === app ? 'bg-bg-tertiary text-text-primary font-medium' : 'text-text-muted hover:text-text-primary'"
            @click="selected = app"
          >
            {{ t(`integrations.apps.${app}.name`) }}
          </button>
        </div>
      </div>
      <div class="card-body" role="tabpanel">
        <ol class="list-decimal list-inside space-y-2 text-sm text-text-secondary">
          <li v-for="n in 4" :key="n">{{ t(`integrations.apps.${selected}.step${n}`) }}</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';
import { checkTorznabResponse, type TorznabCheck } from '~~/shared/utils/torznabResponse';

const { t } = useI18n();
const notifications = useNotificationStore();

const apps = ['prowlarr', 'arr', 'other'] as const;
const selected = ref<(typeof apps)[number]>('prowlarr');

const { data } = await useFetch<{ apiKey: string | null }>('/api/auth/api-key');
const apiKey = computed(() => data.value?.apiKey ?? null);
const revealed = ref(false);

const origin = useRequestURL().origin;
const baseUrl = `${origin}/api/torznab`;
const apiPath = '/api';

const fields = computed(() => {
  const key = apiKey.value ?? '';
  return [
    { key: 'url', label: t('integrations.url'), value: baseUrl, display: baseUrl },
    { key: 'apiPath', label: t('integrations.apiPath'), value: apiPath, display: apiPath },
    {
      key: 'apiKey',
      label: t('integrations.apiKey'),
      value: key,
      display: revealed.value || !key ? key : `${key.slice(0, 7)}${'•'.repeat(key.length - 7)}`,
    },
    {
      key: 'fullUrl',
      label: t('integrations.fullUrl'),
      value: key ? `${baseUrl}${apiPath}?apikey=${key}` : '',
      display: `${baseUrl}${apiPath}?apikey=${revealed.value ? key : '…'}`,
    },
  ];
});

const copiedKey = ref<string | null>(null);
async function copy(key: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 2000);
  } catch {
    notifications.error(t('integrations.copyFailed'));
  }
}

// Same request an indexer makes: a one-result search with the API key
const testing = ref(false);
const testResult = ref<TorznabCheck | null>(null);
async function testConnection() {
  if (!apiKey.value) return;
  testing.value = true;
  testResult.value = null;
  try {
    const params = new URLSearchParams({ t: 'search', limit: '1', apikey: apiKey.value });
    const res = await fetch(`${baseUrl}${apiPath}?${params}`, { credentials: 'omit' });
    testResult.value = checkTorznabResponse(await res.text());
  } catch {
    testResult.value = { ok: false, code: null, description: t('integrations.unreachable') };
  } finally {
    testing.value = false;
  }
}

const rotating = ref(false);
async function rotateKey() {
  if (!confirm(t('integrations.rotateConfirm'))) return;
  rotating.value = true;
  try {
    data.value = await $fetch<{ apiKey: string }>('/api/auth/api-key', { method: 'POST' });
    testResult.value = null;
    notifications.success(t('integrations.rotated'));
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message;
    notifications.error(message || t('integrations.rotateFailed'));
  } finally {
    rotating.value = false;
  }
}

useHead({ title: () => t('integrations.title') });
</script>
