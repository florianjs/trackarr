<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-text-primary tracking-tight uppercase">
          {{ t('bonus.shop.title') }}
        </h2>
        <p class="text-xs text-text-muted font-mono mt-0.5">
          {{ t('bonus.shop.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-6">
        <div class="text-right">
          <p class="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {{ t('bonus.shop.seedingNow') }}
          </p>
          <p class="text-2xl font-bold text-text-primary">{{ me?.seedingNow ?? 0 }}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {{ t('bonus.shop.balance') }}
          </p>
          <p class="text-2xl font-bold text-accent">{{ formatPoints(me?.points ?? 0) }}</p>
        </div>
      </div>
    </div>

    <div v-if="me && !me.enabled" class="card">
      <div class="card-body text-sm text-text-muted">{{ t('bonus.disabled') }}</div>
    </div>

    <template v-else-if="me">
      <div
        v-if="message"
        class="text-xs px-3 py-2 rounded border"
        :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'"
      >
        {{ message.text }}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Items -->
        <div class="card lg:col-span-2">
          <div class="card-header">
            <div class="flex items-center gap-2">
              <Icon name="ph:storefront-bold" class="text-text-muted" />
              <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
                {{ t('bonus.shop.items') }}
              </h3>
            </div>
          </div>
          <div class="card-body">
            <div v-if="items?.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="item in items"
                :key="item.id"
                class="flex flex-col justify-between gap-3 p-4 rounded border border-border bg-bg-tertiary/50"
              >
                <div>
                  <p class="text-sm font-bold text-text-primary">{{ item.name }}</p>
                  <p class="text-[11px] text-accent font-mono mt-0.5">{{ itemEffect(item) }}</p>
                  <p v-if="item.description" class="text-xs text-text-muted mt-2">
                    {{ item.description }}
                  </p>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-bold font-mono">{{ formatPoints(item.price) }}</span>
                  <span
                    v-if="item.type === 'gif_avatar' && me.canUseGifAvatar"
                    class="text-[10px] font-bold uppercase tracking-wider text-success"
                  >
                    {{ t('bonus.shop.owned') }}
                  </span>
                  <button
                    v-else
                    class="btn btn-primary !py-1.5 !px-3 text-xs"
                    :disabled="buying === item.id || me.points < item.price"
                    :title="me.points < item.price ? t('bonus.shop.notEnough') : undefined"
                    @click="buy(item)"
                  >
                    <Icon v-if="buying === item.id" name="ph:circle-notch" class="animate-spin" />
                    {{ t('bonus.shop.buy') }}
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-text-muted">{{ t('bonus.shop.noItems') }}</p>
          </div>
        </div>

        <div class="space-y-6">
          <!-- How to earn -->
          <div class="card">
            <div class="card-header">
              <div class="flex items-center gap-2">
                <Icon name="ph:coins-bold" class="text-text-muted" />
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
                  {{ t('bonus.shop.howToEarn') }}
                </h3>
              </div>
            </div>
            <ul class="card-body space-y-2 text-xs text-text-secondary">
              <li v-if="me.rules.pointsPerSeedDay > 0">
                {{ t('bonus.shop.earnSeed', { points: me.rules.pointsPerSeedDay, max: me.rules.maxSeedingTorrents }) }}
                <span class="block text-[10px] text-text-muted">{{ t('bonus.shop.earnSeedNote') }}</span>
              </li>
              <li v-if="me.rules.pointsPerUpload > 0">
                {{ t('bonus.shop.earnUpload', { points: me.rules.pointsPerUpload }) }}
              </li>
              <li>
                <NuxtLink to="/bounties" class="hover:text-white underline-offset-2 hover:underline">
                  {{ t('bonus.shop.earnBounty') }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Avatar -->
          <div class="card">
            <div class="card-header">
              <div class="flex items-center gap-2">
                <Icon name="ph:user-circle-bold" class="text-text-muted" />
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
                  {{ t('bonus.avatar.title') }}
                </h3>
              </div>
            </div>
            <div class="card-body flex items-center gap-4">
              <div class="w-16 h-16 rounded bg-bg-tertiary border border-border overflow-hidden flex items-center justify-center shrink-0">
                <img v-if="me.avatarUrl" :src="me.avatarUrl" alt="" class="w-full h-full object-cover" />
                <Icon v-else name="ph:user-bold" class="text-2xl text-text-muted" />
              </div>
              <div class="space-y-2">
                <div class="flex gap-2">
                  <button class="btn btn-secondary !py-1.5 !px-3 text-xs" :disabled="avatarBusy" @click="avatarInput?.click()">
                    {{ t('bonus.avatar.upload') }}
                  </button>
                  <button
                    v-if="me.avatarUrl"
                    class="btn btn-secondary !py-1.5 !px-3 text-xs"
                    :disabled="avatarBusy"
                    @click="removeAvatar"
                  >
                    {{ t('bonus.avatar.remove') }}
                  </button>
                </div>
                <p class="text-[10px] text-text-muted">
                  {{ me.canUseGifAvatar ? t('bonus.avatar.hintGif') : t('bonus.avatar.hint') }}
                </p>
                <input
                  ref="avatarInput"
                  type="file"
                  class="hidden"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  @change="uploadAvatar"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="card">
        <div class="card-header">
          <div class="flex items-center gap-2">
            <Icon name="ph:clock-counter-clockwise-bold" class="text-text-muted" />
            <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
              {{ t('bonus.shop.history') }}
            </h3>
          </div>
        </div>
        <div class="card-body">
          <table v-if="me.transactions.length" class="w-full text-xs">
            <tbody>
              <tr v-for="tx in me.transactions" :key="tx.id" class="border-b border-border last:border-0">
                <td class="py-2 text-text-muted font-mono whitespace-nowrap pr-4">{{ formatDateTime(tx.createdAt) }}</td>
                <td class="py-2 pr-4">
                  <span class="font-bold">{{ txLabel(tx.type) }}</span>
                  <span v-if="tx.description" class="text-text-muted"> · {{ tx.description }}</span>
                </td>
                <td class="py-2 text-right font-mono font-bold" :class="tx.amount >= 0 ? 'text-success' : 'text-error'">
                  {{ tx.amount >= 0 ? '+' : '' }}{{ formatPoints(tx.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-xs text-text-muted">{{ t('bonus.shop.noHistory') }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: number;
  value: number;
}

interface BonusMe {
  enabled: boolean;
  points: number;
  avatarUrl: string | null;
  canUseGifAvatar: boolean;
  seedingNow: number;
  rules: {
    pointsPerSeedDay: number;
    maxSeedingTorrents: number;
    pointsPerUpload: number;
    bountyMinPoints: number;
  };
  transactions: {
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }[];
}

const { t, te, locale } = useI18n();

const { data: me, refresh: refreshMe } = await useFetch<BonusMe>('/api/bonus/me');
// Answers 403 when the bonus system is disabled: the notice above covers it
const { data: items } = await useFetch<ShopItem[]>('/api/shop/items', {
  default: () => [],
});

useHead({ title: () => t('bonus.shop.title') });

const buying = ref<string | null>(null);
const avatarBusy = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);
const message = ref<{ ok: boolean; text: string } | null>(null);

function errorText(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string } };
  return e.data?.message || fallback;
}

function formatPoints(n: number): string {
  return t('bonus.points', { n: Math.floor(n).toLocaleString(locale.value) });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(locale.value, { dateStyle: 'short', timeStyle: 'short' });
}

function txLabel(type: string): string {
  const key = `bonus.tx.${type}`;
  return te(key) ? t(key) : type;
}

function itemEffect(item: ShopItem): string {
  if (item.type === 'upload_credit') return t('bonus.shop.itemUpload', { size: formatSize(item.value) });
  if (item.type === 'invite') return t('bonus.shop.itemInvite', { count: item.value }, item.value);
  if (item.type === 'gif_avatar') return t('bonus.shop.itemGifAvatar');
  return '';
}

async function buy(item: ShopItem) {
  if (!confirm(t('bonus.shop.confirmBuy', { name: item.name, price: item.price }))) return;
  buying.value = item.id;
  message.value = null;
  try {
    await $fetch('/api/shop/purchase', { method: 'POST', body: { itemId: item.id } });
    message.value = { ok: true, text: t('bonus.shop.bought', { name: item.name }) };
    await refreshMe();
  } catch (err) {
    message.value = { ok: false, text: errorText(err, t('bonus.shop.notEnough')) };
  } finally {
    buying.value = null;
  }
}

async function uploadAvatar(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  avatarBusy.value = true;
  message.value = null;
  try {
    const form = new FormData();
    form.append('avatar', file);
    await $fetch('/api/users/me/avatar', { method: 'POST', body: form });
    message.value = { ok: true, text: t('bonus.avatar.updated') };
    await refreshMe();
  } catch (err) {
    message.value = { ok: false, text: errorText(err, t('bonus.avatar.hint')) };
  } finally {
    avatarBusy.value = false;
  }
}

async function removeAvatar() {
  if (!confirm(t('bonus.avatar.confirmRemove'))) return;
  avatarBusy.value = true;
  try {
    await $fetch('/api/users/me/avatar', { method: 'DELETE' });
    message.value = { ok: true, text: t('bonus.avatar.removed') };
    await refreshMe();
  } finally {
    avatarBusy.value = false;
  }
}
</script>
