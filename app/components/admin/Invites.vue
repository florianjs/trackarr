<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:envelope-simple-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Invitations
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
          Generate Unique Codes
        </h4>
        <div class="flex gap-2 mb-3">
          <input
            v-model.number="generateCount"
            type="number"
            min="1"
            max="50"
            placeholder="Count"
            class="input w-24 !py-2 text-xs"
          />
          <input
            v-model.number="expiresInDays"
            type="number"
            min="0"
            max="365"
            placeholder="Expires in days (optional)"
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
            Generate
          </button>
        </div>
        <!-- Generated Codes Display -->
        <div
          v-if="generatedCodes.length > 0"
          class="p-2 rounded bg-bg-primary border border-border"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Generated Codes
            </span>
            <button
              @click="copyAllCodes"
              class="text-[10px] text-accent hover:underline"
            >
              Copy All
            </button>
          </div>
          <div class="flex flex-wrap gap-1">
            <code
              v-for="code in generatedCodes"
              :key="code"
              @click="copyCode(code)"
              class="px-2 py-0.5 text-[10px] font-mono bg-bg-tertiary rounded border border-border cursor-pointer hover:border-accent/50"
              title="Click to copy"
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
          Grant Invites to User
        </h4>
        <div class="flex gap-2">
          <input
            v-model="grantUserId"
            type="text"
            placeholder="User ID"
            class="input flex-1 !py-2 text-xs font-mono"
          />
          <input
            v-model.number="grantCount"
            type="number"
            min="1"
            max="100"
            placeholder="Count"
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
            Grant
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
                title="Click to copy"
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
                Created by:
                <span class="font-mono">{{ invite.creator?.username }}</span>
              </span>
              <span v-if="invite.usedByUser">
                Used by:
                <span class="font-mono">{{ invite.usedByUser.username }}</span>
              </span>
              <span>
                {{ formatDate(invite.createdAt) }}
              </span>
              <span
                v-if="invite.expiresAt && !invite.usedBy"
                :class="isExpired(invite.expiresAt) ? 'text-error' : ''"
              >
                Expires: {{ formatDate(invite.expiresAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        No invitations found
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
          Prev
        </button>
        <span class="text-xs text-text-muted self-center">
          {{ page }} / {{ invites.pagination.pages }}
        </span>
        <button
          @click="page++"
          :disabled="page >= invites.pagination.pages"
          class="btn btn-secondary !px-3 !py-1 text-[10px]"
        >
          Next
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
  return new Date(date).toLocaleDateString('en-US', {
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
  if (invite.usedBy) return 'Used';
  if (invite.expiresAt && isExpired(invite.expiresAt)) return 'Expired';
  return 'Pending';
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
    notifications.success(`Generated ${result.codes.length} invite code(s)`);
    await refresh();
  } catch (error: any) {
    console.error('Failed to generate codes:', error);
    notifications.error(error.data?.message || 'Failed to generate codes');
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
    notifications.success(`Granted ${grantCount.value} invites to user`);
    grantUserId.value = '';
    grantCount.value = 2;
    await refresh();
  } catch (error: any) {
    console.error('Failed to grant invites:', error);
    notifications.error(error.data?.message || 'Failed to grant invites');
  } finally {
    isGranting.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    notifications.success('Code copied!');
  } catch {
    notifications.error('Failed to copy code');
  }
}

async function copyAllCodes() {
  try {
    await navigator.clipboard.writeText(generatedCodes.value.join('\n'));
    notifications.success('All codes copied!');
  } catch {
    notifications.error('Failed to copy codes');
  }
}
</script>
