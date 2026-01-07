<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:users-bold" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          User Management
        </h3>
      </div>
    </div>
    <div class="card-body">
      <div class="flex gap-2 mb-6">
        <input
          v-model="userSearchQuery"
          type="text"
          placeholder="Search by username or email..."
          class="input flex-1 !py-2 text-xs font-bold uppercase tracking-wider"
          @keyup.enter="searchUsers"
        />
        <button
          class="btn btn-primary !px-6 flex items-center gap-2 uppercase tracking-widest font-bold text-xs"
          :disabled="!userSearchQuery.trim() || isSearching"
          @click="searchUsers"
        >
          <Icon
            v-if="isSearching"
            name="ph:circle-notch"
            class="animate-spin"
          />
          <Icon v-else name="ph:magnifying-glass-bold" />
          <span>Search</span>
        </button>
      </div>

      <div v-if="foundUsers.length > 0" class="space-y-3">
        <div
          v-for="u in foundUsers"
          :key="u.id"
          class="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded border border-border"
        >
          <div>
            <p
              class="text-xs font-bold text-text-primary uppercase tracking-wider"
            >
              {{ u.username }}
            </p>
            <p class="text-[10px] font-mono text-text-muted">
              ID: {{ u.id.substring(0, 8) }}...
            </p>
            <p
              v-if="u.lastIp"
              class="text-[8px] font-mono text-text-muted/50 mt-0.5"
            >
              IP: {{ u.lastIp }}
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >Ban</label
              >
              <button
                @click="toggleBan(u)"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                :class="
                  u.isBanned ? 'bg-error' : 'bg-bg-primary border border-border'
                "
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                  :class="u.isBanned ? 'translate-x-5' : 'translate-x-1'"
                />
              </button>
            </div>
            <div v-if="user?.isAdmin && roles.length > 0" class="flex items-center gap-2">
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >Role</label
              >
              <select
                :value="u.roleId || ''"
                @change="assignRole(u, ($event.target as HTMLSelectElement).value)"
                class="bg-bg-primary border border-border rounded px-2 py-1 text-[10px] font-bold text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="">No Role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
            <div v-if="user?.isAdmin" class="flex items-center gap-2">
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >Mod</label
              >
              <button
                @click="toggleUserRole(u, 'isModerator')"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                :class="
                  u.isModerator
                    ? 'bg-success'
                    : 'bg-bg-primary border border-border'
                "
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                  :class="u.isModerator ? 'translate-x-5' : 'translate-x-1'"
                />
              </button>
            </div>
            <div v-if="user?.isAdmin" class="flex items-center gap-2">
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >Admin</label
              >
              <button
                @click="toggleUserRole(u, 'isAdmin')"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                :class="
                  u.isAdmin
                    ? 'bg-success'
                    : 'bg-bg-primary border border-border'
                "
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                  :class="u.isAdmin ? 'translate-x-5' : 'translate-x-1'"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-else-if="hasSearched"
        class="text-center py-8 border border-dashed border-border rounded bg-bg-primary/30"
      >
        <p
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
        >
          No users found
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Role {
  id: string;
  name: string;
  color: string;
  canUploadWithoutModeration: boolean;
}

const { user } = useUserSession();
const userSearchQuery = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const foundUsers = ref<any[]>([]);
const roles = ref<Role[]>([]);

// Load roles on mount
onMounted(async () => {
  if (user.value?.isAdmin) {
    try {
      roles.value = (await $fetch('/api/admin/roles')) as Role[];
    } catch (error: any) {
      console.error('Failed to load roles:', error);
    }
  }
});

async function searchUsers() {
  if (!userSearchQuery.value.trim() || isSearching.value) return;

  isSearching.value = true;
  try {
    foundUsers.value = (await $fetch('/api/admin/users', {
      params: { search: userSearchQuery.value.trim() },
    })) as any[];
    hasSearched.value = true;
  } catch (error: any) {
    console.error('Failed to search users:', error);
  } finally {
    isSearching.value = false;
  }
}

async function toggleUserRole(user: any, role: 'isAdmin' | 'isModerator') {
  try {
    const updatedUser = await $fetch(`/api/admin/users/${user.id}/role`, {
      method: 'PUT',
      body: {
        ...user,
        [role]: !user[role],
      },
    });
    // Update local state
    const index = foundUsers.value.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      foundUsers.value[index] = updatedUser;
    }
  } catch (error: any) {
    alert(error.data?.message || 'Failed to update user role');
  }
}

async function toggleBan(user: any) {
  const action = user.isBanned ? 'unban' : 'ban';
  if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) return;

  try {
    await $fetch(`/api/admin/users/${user.id}/${action}`, {
      method: 'POST',
      body: action === 'ban' ? { reason: 'Banned by admin' } : {},
    });

    // Update local state
    const index = foundUsers.value.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      foundUsers.value[index].isBanned = !user.isBanned;
    }
  } catch (error: any) {
    alert(error.data?.message || `Failed to ${action} user`);
  }
}

async function assignRole(targetUser: any, roleId: string) {
  try {
    await $fetch(`/api/admin/users/${targetUser.id}/assign-role`, {
      method: 'PUT',
      body: { roleId: roleId || null },
    });
    // Update local state
    const index = foundUsers.value.findIndex((u) => u.id === targetUser.id);
    if (index !== -1) {
      foundUsers.value[index].roleId = roleId || null;
    }
  } catch (error: any) {
    alert(error.data?.message || 'Failed to assign role');
  }
}
</script>
