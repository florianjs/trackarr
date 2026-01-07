<template>
  <div>
    <div class="flex items-end justify-between mb-6">
      <div>
        <h2
          class="text-xl font-bold text-text-primary tracking-tight uppercase"
        >
          My Invitations
        </h2>
        <p class="text-xs text-text-muted font-mono mt-0.5">
          Invite new members to the tracker
        </p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <p
            class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
          >
            Invites Remaining
          </p>
          <p class="text-2xl font-bold text-accent">
            {{ inviteData?.remaining || 0 }}
          </p>
        </div>
        <button
          @click="generateInvite"
          :disabled="!inviteData?.remaining || isGenerating"
          class="btn btn-primary"
        >
          <Icon
            v-if="isGenerating"
            name="ph:circle-notch"
            class="animate-spin mr-2"
          />
          <Icon v-else name="ph:plus-bold" class="mr-2" />
          Generate Invite
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:envelope-simple-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Your Invites
          </h3>
        </div>
      </div>
      <div class="card-body">
        <div
          v-if="inviteData?.invites && inviteData.invites.length > 0"
          class="space-y-3"
        >
          <div
            v-for="invite in inviteData.invites"
            :key="invite.id"
            class="flex items-center justify-between p-4 rounded border border-border bg-bg-tertiary/50"
          >
            <div>
              <div class="flex items-center gap-3 mb-2">
                <code
                  class="px-3 py-1.5 text-sm font-mono bg-bg-primary rounded border border-border select-all cursor-pointer"
                  @click="copyCode(invite.code)"
                  title="Click to copy"
                >
                  {{ invite.code }}
                </code>
                <span
                  class="px-2 py-0.5 text-[10px] font-bold uppercase rounded"
                  :class="getStatusClass(invite)"
                >
                  {{ getStatusLabel(invite) }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-[10px] text-text-muted">
                <span> Created: {{ formatDate(invite.createdAt) }} </span>
                <span v-if="invite.usedByUser">
                  Used by:
                  <span class="font-mono">{{
                    invite.usedByUser.username
                  }}</span>
                </span>
                <span
                  v-else-if="invite.expiresAt"
                  :class="isExpired(invite.expiresAt) ? 'text-error' : ''"
                >
                  Expires: {{ formatDate(invite.expiresAt) }}
                </span>
              </div>
            </div>
            <button
              v-if="!invite.usedBy && !isExpired(invite.expiresAt)"
              @click="copyCode(invite.code)"
              class="btn btn-secondary !px-3 !py-2 text-xs"
            >
              <Icon name="ph:copy-bold" class="mr-1" />
              Copy
            </button>
          </div>
        </div>
        <div
          v-else
          class="text-center py-12 border border-dashed border-border rounded bg-bg-primary/30"
        >
          <Icon
            name="ph:envelope-simple-bold"
            class="w-12 h-12 text-text-muted/30 mx-auto mb-4"
          />
          <p
            class="text-xs font-bold text-text-muted uppercase tracking-widest mb-2"
          >
            No invites yet
          </p>
          <p class="text-[10px] text-text-muted">
            Generate an invite code to share with friends
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';

interface Invite {
  id: string;
  code: string;
  usedBy?: string;
  createdAt: string;
  usedAt?: string;
  expiresAt?: string;
  usedByUser?: { id: string; username: string };
}

interface InviteResponse {
  invites: Invite[];
  remaining: number;
}

const notifications = useNotificationStore();
const isGenerating = ref(false);

const { data: inviteData, refresh } =
  await useFetch<InviteResponse>('/api/invites');

function getStatusClass(invite: Invite) {
  if (invite.usedBy) return 'bg-success/20 text-success';
  if (invite.expiresAt && isExpired(invite.expiresAt))
    return 'bg-error/20 text-error';
  return 'bg-warning/20 text-warning';
}

function getStatusLabel(invite: Invite) {
  if (invite.usedBy) return 'Used';
  if (invite.expiresAt && isExpired(invite.expiresAt)) return 'Expired';
  return 'Active';
}

function isExpired(date?: string) {
  if (!date) return false;
  return new Date(date) < new Date();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function generateInvite() {
  if (isGenerating.value) return;
  isGenerating.value = true;
  try {
    await $fetch('/api/invites', { method: 'POST' });
    await refresh();
    notifications.success('Invite code generated!');
  } catch (error: any) {
    notifications.error(error.data?.message || 'Failed to generate invite');
  } finally {
    isGenerating.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    notifications.success('Invite code copied to clipboard!');
  } catch {
    notifications.error('Failed to copy code');
  }
}
</script>
