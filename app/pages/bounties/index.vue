<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight text-text-primary">
          {{ t('bonus.bounties.title') }}
        </h2>
        <p class="text-sm text-text-muted mt-0.5">
          {{ t('bonus.bounties.subtitle') }}
        </p>
      </div>
      <button class="btn btn-primary" @click="showForm = !showForm">
        <Icon name="ph:plus-bold" class="mr-2" />
        {{ t('bonus.bounties.new') }}
      </button>
    </div>

    <!-- Create -->
    <div v-if="showForm" class="card">
      <div class="card-body space-y-3">
        <div class="space-y-1">
          <label class="text-xs font-bold text-text-muted ml-1">
            {{ t('bonus.bounties.form.title') }}
          </label>
          <input
            v-model="form.title"
            type="text"
            maxlength="200"
            class="input w-full !py-2 text-xs"
            :placeholder="t('bonus.bounties.form.titlePlaceholder')"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-bold text-text-muted ml-1">
            {{ t('bonus.bounties.form.description') }}
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="5000"
            class="input w-full !py-2 text-xs resize-none"
            :placeholder="t('bonus.bounties.form.descriptionPlaceholder')"
          ></textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-bold text-text-muted ml-1">
              {{ t('bonus.bounties.form.imdb') }}
            </label>
            <input v-model="form.imdbId" type="text" class="input w-full !py-2 text-xs font-mono" placeholder="tt0133093" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-text-muted ml-1">
              {{ t('bonus.bounties.form.category') }}
            </label>
            <select v-model="form.categoryId" class="input w-full !py-2 text-xs">
              <option value="">—</option>
              <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-text-muted ml-1">
              {{ t('bonus.bounties.form.points') }}
            </label>
            <input v-model.number="form.points" type="number" :min="minPoints" class="input w-full !py-2 text-xs font-mono" />
          </div>
        </div>
        <p class="text-xs text-text-muted">
          {{ t('bonus.bounties.form.pointsHint', { min: minPoints }) }}
        </p>
        <p v-if="formError" class="text-xs text-error">{{ formError }}</p>
        <div class="flex gap-2">
          <button class="btn btn-primary !py-2 text-xs" :disabled="submitting || form.title.trim().length < 3" @click="create">
            {{ t('bonus.bounties.form.submit') }}
          </button>
          <button class="btn btn-secondary !py-2 text-xs" @click="showForm = false">
            {{ t('bonus.bounties.form.cancel') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="s in statuses"
        :key="s"
        class="text-xs font-bold px-3 py-1.5 rounded border transition-colors"
        :class="status === s ? 'border-white/30 text-white bg-bg-secondary' : 'border-border text-text-muted hover:text-white'"
        @click="status = s"
      >
        {{ t(`bonus.bounties.status.${s}`) }}
      </button>
      <input
        v-model="search"
        type="search"
        class="input !py-1.5 text-xs ml-auto w-full sm:w-64"
        :placeholder="t('bonus.bounties.search')"
      />
    </div>

    <!-- Staff: bulk actions on the selection -->
    <div v-if="isStaff && data?.bounties.length" class="flex flex-wrap items-center gap-2 text-xs">
      <label class="flex items-center gap-2 text-text-secondary">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="selected.length > 0 && !allSelected"
          @change="selected = toggleAll(selected, visibleIds)"
        />{{ t('bonus.bounties.bulk.selectAll') }}
      </label>
      <template v-if="selected.length">
        <span class="ml-auto text-text-muted num">{{ t('bonus.bounties.bulk.selected', { count: selected.length }) }}</span>
        <button type="button" class="btn btn-secondary text-xs" :disabled="bulkBusy" @click="runBulk('cancel')">
          <Icon name="ph:x-circle" aria-hidden="true" />{{ t('bonus.bounties.bulk.cancel') }}
        </button>
        <button type="button" class="btn btn-secondary text-xs hover:!text-danger" :disabled="bulkBusy" @click="runBulk('delete')">
          <Icon name="ph:trash" aria-hidden="true" />{{ t('bonus.bounties.bulk.delete') }}
        </button>
        <button type="button" class="btn btn-ghost text-xs" @click="selected = []">{{ t('bonus.bounties.bulk.clear') }}</button>
      </template>
    </div>

    <!-- List -->
    <div class="card">
      <div class="card-body">
        <div v-if="data?.bounties.length" class="divide-y divide-border">
          <div v-for="b in data.bounties" :key="b.id" class="flex items-center gap-3">
            <input
              v-if="isStaff"
              type="checkbox"
              class="shrink-0"
              :checked="selected.includes(b.id)"
              :aria-label="t('bonus.bounties.bulk.select', { title: b.title })"
              @change="selected = toggleSelection(selected, b.id)"
            />
            <NuxtLink
              :to="`/bounties/${b.id}`"
              class="flex-1 min-w-0 flex items-center justify-between gap-4 py-3 hover:bg-bg-tertiary/30 px-2 -mx-2 rounded transition-colors"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-primary truncate">{{ b.title }}</p>
                <p class="text-sm text-text-muted mt-0.5">
                  {{ t('bonus.bounties.requestedBy', { user: b.requester?.username ?? '?' }) }}
                  <span v-if="b.category"> · {{ b.category.name }}</span>
                  · {{ new Date(b.createdAt).toLocaleDateString(locale) }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-medium num text-text-primary">
                  {{ t('bonus.points', { n: Math.floor(b.totalPoints).toLocaleString(locale) }) }}
                </p>
                <p class="text-xs text-text-muted">
                  {{ t(`bonus.bounties.status.${b.status}`) }}
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>
        <p v-else class="text-xs text-text-muted">{{ t('bonus.bounties.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toggleAll, toggleSelection } from '~~/shared/utils/bulk';

import { refDebounced } from '@vueuse/core';

interface BountyRow {
  id: string;
  title: string;
  status: string;
  totalPoints: number;
  createdAt: string;
  requester: { id: string; username: string } | null;
  category: { id: string; name: string } | null;
}

interface CategoryNode {
  id: string;
  name: string;
  subcategories?: CategoryNode[];
}

const { t, locale } = useI18n();
useHead({ title: () => t('bonus.bounties.title') });

const statuses = ['open', 'claimed', 'filled', 'cancelled', 'all'] as const;
const status = ref<(typeof statuses)[number]>('open');
const search = ref('');
const debouncedSearch = refDebounced(search, 300);

const { data, refresh } = await useFetch<{ bounties: BountyRow[] }>('/api/bounties', {
  query: { status, q: debouncedSearch },
});
const { data: me } = await useFetch<{ rules: { bountyMinPoints: number } }>('/api/bonus/me');
const { data: categories } = await useFetch<CategoryNode[]>('/api/categories', { default: () => [] });

// Bulk actions (staff)
const { user } = useUserSession();
const notifications = useNotificationStore();
const isStaff = computed(() => Boolean(user.value?.isAdmin || user.value?.isModerator));
const selected = ref<string[]>([]);
const bulkBusy = ref(false);
const visibleIds = computed(() => data.value?.bounties.map((b) => b.id) ?? []);
const allSelected = computed(() => visibleIds.value.length > 0 && visibleIds.value.every((id) => selected.value.includes(id)));
watch([status, debouncedSearch], () => (selected.value = []));

async function runBulk(action: 'cancel' | 'delete') {
  if (!selected.value.length || bulkBusy.value) return;
  if (!confirm(t(`bonus.bounties.bulk.confirm.${action}`, { count: selected.value.length }))) return;
  bulkBusy.value = true;
  try {
    const res = await $fetch<{ count: number; skipped: number }>('/api/bounties/bulk', {
      method: 'POST',
      body: { action, ids: selected.value },
    });
    notifications.success(
      t(`bonus.bounties.bulk.done.${action}`, { count: res.count }),
      res.skipped ? t('bonus.bounties.bulk.skipped', { count: res.skipped }) : undefined
    );
    selected.value = [];
    await refresh();
  } catch (err) {
    notifications.error(t('bonus.bounties.bulk.failed'), (err as { data?: { message?: string } }).data?.message);
  } finally {
    bulkBusy.value = false;
  }
}

const minPoints = computed(() => me.value?.rules.bountyMinPoints ?? 100);

const flatCategories = computed(() => {
  const out: { id: string; name: string }[] = [];
  const walk = (nodes: CategoryNode[], prefix: string) => {
    for (const n of nodes) {
      out.push({ id: n.id, name: prefix + n.name });
      if (n.subcategories) walk(n.subcategories, `${prefix}${n.name} › `);
    }
  };
  walk(categories.value ?? [], '');
  return out;
});

const showForm = ref(false);
const submitting = ref(false);
const formError = ref<string | null>(null);
const form = reactive({ title: '', description: '', imdbId: '', categoryId: '', points: 100 });

watch(minPoints, (min) => {
  if (form.points < min) form.points = min;
}, { immediate: true });

async function create() {
  submitting.value = true;
  formError.value = null;
  try {
    const res = await $fetch<{ id: string }>('/api/bounties', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        imdbId: form.imdbId.trim() || undefined,
        categoryId: form.categoryId || null,
        points: form.points,
      },
    });
    await navigateTo(`/bounties/${res.id}`);
  } catch (err) {
    formError.value = (err as { data?: { message?: string } }).data?.message ?? 'Error';
    await refresh();
  } finally {
    submitting.value = false;
  }
}
</script>
