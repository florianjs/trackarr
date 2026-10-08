<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:envelope-simple-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ t('admin.invites.title') }}
          </h3>
        </div>
      </div>
    </div>
    <div class="card-body">
      <!-- Generate Unique Codes Section -->
      <div class="mb-6 p-3 rounded border border-accent/30 bg-accent/5">
        <h4
          class="text-[10px] font-bold uppercase tracking-widest text-accent mb-3"
        >
          {{ t('admin.invites.generateTitle') }}
        </h4>
        <div class="flex gap-2 mb-3">
          <input
            v-model.number="generateCount"
            type="number"
            min="1"
            max="50"
            :placeholder="t('admin.invites.count')"
            class="input w-24 !py-2 text-xs"
          />
          <input
            v-model.number="expiresInDays"
            type="number"
            min="0"
            max="365"
            :placeholder="t('admin.invites.expiresInDays')"
            class="input flex-1 !py-2 text-xs"
          />
          <button
            @click="generateCodes"
            :disabled="!generateCount || isGenerating"
            class="btn btn-primary !px-4 !py-2 text-xs"
          >
            <Icon
              v-if="isGenerating"
              name="ph:circle-notch"
              class="animate-spin mr-1"
            />
            {{ t('admin.invites.generate') }}
          </button>
        </div>
        <!-- Generated Codes Display -->
        <div
          v-if="generatedCodes.length > 0"
          class="p-2 rounded bg-bg-primary border border-border"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {{ t('admin.invites.generatedCodes') }}
            </span>
            <button
              @click="copyAllCodes"
              class="text-[10px] text-accent hover:underline"
            >
              {{ t('admin.invites.copyAll') }}
            </button>
          </div>
          <div class="flex flex-wrap gap-1">
            <code
              v-for="code in generatedCodes"
              :key="code"
              @click="copyCode(code)"
              class="px-2 py-0.5 text-[10px] font-mono bg-bg-tertiary rounded border border-border cursor-pointer hover:border-accent/50"
              :title="t('admin.invites.clickToCopy')"
            >
              {{ code }}
            </code>
          </div>
        </div>
      </div>

      <!-- Grant Invites Form -->
      <div class="mb-6 p-3 rounded border border-border bg-bg-tertiary/50">
        <h4
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
        >
          {{ t('admin.invites.grantTitle') }}
        </h4>
        <div class="flex gap-2">
          <input
            v-model="grantUserId"
            type="text"
            :placeholder="t('admin.invites.userId')"
            class="input flex-1 !py-2 text-xs font-mono"
          />
          <input
            v-model.number="grantCount"
            type="number"
            min="1"
            max="100"
            :placeholder="t('admin.invites.count')"
            class="input w-20 !py-2 text-xs"
          />
          <button
            @click="grantInvites"
            :disabled="!grantUserId || !grantCount || isGranting"
            class="btn btn-primary !px-4 !py-2 text-xs"
          >
            <Icon
              v-if="isGranting"
              name="ph:circle-notch"
              class="animate-spin mr-1"
            />
            {{ t('admin.invites.grant') }}
          </button>
        </div>
      </div>

      <!-- Invites List -->
      <div v-if="invites?.data && invites.data.length > 0" class="space-y-2">
        <div
          v-for="invite in invites.data"
          :key="invite.id"
          class="flex items-center justify-between p-3 rounded border border-border bg-bg-tertiary/50"
        >
          <div>
            <div class="flex items-center gap-2 mb-1">
              <code
                class="px-2 py-0.5 text-xs font-mono bg-bg-primary rounded border border-border cursor-pointer hover:border-accent/50"
                @click="copyCode(invite.code)"
                :title="t('admin.invites.clickToCopy')"
              >
                {{ invite.code }}
              </code>
              <span
                class="px-2 py-0.5 text-[10px] font-bold uppercase rounded"
                :class="getInviteStatusClass(invite)"
              >
                {{ getInviteStatus(invite) }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-[10px] text-text-muted">
              <span>
                {{ t('admin.invites.createdBy') }}
                <span class="font-mono">{{ invite.creator?.username }}</span>
              </span>
              <span v-if="invite.usedByUser">
                {{ t('admin.invites.usedBy') }}
                <span class="font-mono">{{ invite.usedByUser.username }}</span>
              </span>
              <span>
                {{ formatDate(invite.createdAt) }}
              </span>
              <span
                v-if="invite.expiresAt && !invite.usedBy"
                :class="isExpired(invite.expiresAt) ? 'text-error' : ''"
              >
                {{ t('admin.invites.expires', { date: formatDate(invite.expiresAt) }) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        {{ t('admin.invites.empty') }}
      </p>

      <!-- Pagination -->
      <div
        v-if="invites?.pagination && invites.pagination.pages > 1"
        class="flex justify-center gap-2 mt-4"
      >
        <button
          @click="page--"
          :disabled="page <= 1"
          class="btn btn-secondary !px-3 !py-1 text-[10px]"
        >
          {{ t('common.previous') }}
        </button>
        <span class="text-xs text-text-muted self-center">
          {{ page }} / {{ invites.pagination.pages }}
        </span>
        <button
          @click="page++"
          :disabled="page >= invites.pagination.pages"
          class="btn btn-secondary !px-3 !py-1 text-[10px]"
        >
          {{ t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';

interface Invitation {
  id: string;
  code: string;
  createdBy: string;
  usedBy?: string;
  createdAt: string;
  usedAt?: string;
  expiresAt?: string;
  creator?: { id: string; username: string };
  usedByUser?: { id: string; username: string };
}

interface InvitesResponse {
  data: Invitation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const { t, locale } = useI18n();
const notifications = useNotificationStore();
const page = ref(1);
const grantUserId = ref('');
const grantCount = ref(2);
const isGranting = ref(false);

// Generate codes state
const generateCount = ref(5);
const expiresInDays = ref<number | undefined>(undefined);
const isGenerating = ref(false);
const generatedCodes = ref<string[]>([]);

const { data: invites, refresh } = await useFetch<InvitesResponse>(
  '/api/admin/invites',
  {
    query: computed(() => ({ page: page.value })),
  }
);

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date) < new Date();
}

function getInviteStatus(invite: Invitation) {
  if (invite.usedBy) return t('admin.invites.statusUsed');
  if (invite.expiresAt && isExpired(invite.expiresAt)) return t('admin.invites.statusExpired');
  return t('admin.invites.statusPending');
}

function getInviteStatusClass(invite: Invitation) {
  if (invite.usedBy) return 'bg-success/20 text-success';
  if (invite.expiresAt && isExpired(invite.expiresAt)) return 'bg-error/20 text-error';
  return 'bg-warning/20 text-warning';
}

async function generateCodes() {
  if (!generateCount.value) return;
  isGenerating.value = true;
  try {
    const result = await $fetch<{ codes: string[] }>('/api/admin/invites/generate', {
      method: 'POST',
      body: {
        count: generateCount.value,
        expiresInDays: expiresInDays.value || undefined,
      },
    });
    generatedCodes.value = result.codes;
    notifications.success(
      t('admin.invites.generatedToast', result.codes.length)
    );
    await refresh();
  } catch (error: any) {
    console.error('Failed to generate codes:', error);
    notifications.error(error.data?.message || t('admin.invites.generateFailed'));
  } finally {
    isGenerating.value = false;
  }
}

async function grantInvites() {
  if (!grantUserId.value || !grantCount.value) return;
  isGranting.value = true;
  try {
    await $fetch('/api/admin/invites/grant', {
      method: 'POST',
      body: {
        userId: grantUserId.value,
        count: grantCount.value,
      },
    });
    notifications.success(t('admin.invites.grantedToast', grantCount.value));
    grantUserId.value = '';
    grantCount.value = 2;
    await refresh();
  } catch (error: any) {
    console.error('Failed to grant invites:', error);
    notifications.error(error.data?.message || t('admin.invites.grantFailed'));
  } finally {
    isGranting.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    notifications.success(t('admin.invites.codeCopied'));
  } catch {
    notifications.error(t('admin.invites.copyCodeFailed'));
  }
}

async function copyAllCodes() {
  try {
    await navigator.clipboard.writeText(generatedCodes.value.join('\n'));
    notifications.success(t('admin.invites.allCodesCopied'));
  } catch {
    notifications.error(t('admin.invites.copyCodesFailed'));
  }
}
</script>
