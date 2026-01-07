<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:user-circle-gear-bold" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Role Management
        </h3>
      </div>
    </div>
    <div class="card-body">
      <!-- Create new role form -->
      <div class="mb-6 p-4 bg-bg-tertiary/50 rounded border border-border">
        <h4
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
        >
          Create New Role
        </h4>
        <div class="flex flex-wrap gap-3">
          <input
            v-model="newRole.name"
            type="text"
            placeholder="Role name..."
            class="input flex-1 min-w-[150px] !py-2 text-xs"
          />
          <div class="flex items-center gap-2">
            <label class="text-[10px] font-bold text-text-muted uppercase"
              >Color</label
            >
            <input
              v-model="newRole.color"
              type="color"
              class="w-8 h-8 rounded cursor-pointer border border-border"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-[10px] font-bold text-text-muted uppercase"
              >Skip Moderation</label
            >
            <button
              @click="newRole.canUploadWithoutModeration = !newRole.canUploadWithoutModeration"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
              :class="
                newRole.canUploadWithoutModeration
                  ? 'bg-success'
                  : 'bg-bg-primary border border-border'
              "
            >
              <span
                class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                :class="
                  newRole.canUploadWithoutModeration
                    ? 'translate-x-5'
                    : 'translate-x-1'
                "
              />
            </button>
          </div>
          <button
            @click="createRole"
            :disabled="!newRole.name.trim() || isCreating"
            class="btn btn-primary !px-4 flex items-center gap-2 uppercase tracking-widest font-bold text-xs"
          >
            <Icon
              v-if="isCreating"
              name="ph:circle-notch"
              class="animate-spin"
            />
            <Icon v-else name="ph:plus-bold" />
            <span>Create</span>
          </button>
        </div>
      </div>

      <!-- Existing roles list -->
      <div v-if="roles.length > 0" class="space-y-3">
        <div
          v-for="role in roles"
          :key="role.id"
          class="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded border border-border"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: role.color }"
            />
            <div>
              <p
                class="text-xs font-bold text-text-primary uppercase tracking-wider"
              >
                {{ role.name }}
              </p>
              <p class="text-[10px] text-text-muted">
                <span v-if="role.canUploadWithoutModeration" class="text-success"
                  >Can bypass moderation</span
                >
                <span v-else class="text-text-muted/50"
                  >Requires moderation</span
                >
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >Skip Mod</label
              >
              <button
                @click="togglePermission(role)"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                :class="
                  role.canUploadWithoutModeration
                    ? 'bg-success'
                    : 'bg-bg-primary border border-border'
                "
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                  :class="
                    role.canUploadWithoutModeration
                      ? 'translate-x-5'
                      : 'translate-x-1'
                  "
                />
              </button>
            </div>
            <button
              @click="deleteRole(role)"
              class="text-error hover:text-error/80 transition-colors p-1"
              title="Delete role"
            >
              <Icon name="ph:trash-bold" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        v-else-if="!isLoading"
        class="text-center py-8 border border-dashed border-border rounded bg-bg-primary/30"
      >
        <p
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
        >
          No roles created yet
        </p>
      </div>
      <div v-if="isLoading" class="flex justify-center py-8">
        <Icon name="ph:circle-notch" class="animate-spin text-text-muted" />
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
  createdAt: string;
}

const roles = ref<Role[]>([]);
const isLoading = ref(true);
const isCreating = ref(false);

const newRole = ref({
  name: '',
  color: '#6b7280',
  canUploadWithoutModeration: false,
});

async function loadRoles() {
  isLoading.value = true;
  try {
    roles.value = (await $fetch('/api/admin/roles')) as Role[];
  } catch (error: any) {
    console.error('Failed to load roles:', error);
  } finally {
    isLoading.value = false;
  }
}

async function createRole() {
  if (!newRole.value.name.trim() || isCreating.value) return;

  isCreating.value = true;
  try {
    const created = (await $fetch('/api/admin/roles', {
      method: 'POST',
      body: newRole.value,
    })) as Role;
    roles.value.push(created);
    newRole.value = {
      name: '',
      color: '#6b7280',
      canUploadWithoutModeration: false,
    };
  } catch (error: any) {
    alert(error.data?.message || 'Failed to create role');
  } finally {
    isCreating.value = false;
  }
}

async function togglePermission(role: Role) {
  try {
    const updated = (await $fetch(`/api/admin/roles/${role.id}`, {
      method: 'PUT',
      body: {
        canUploadWithoutModeration: !role.canUploadWithoutModeration,
      },
    })) as Role;
    const index = roles.value.findIndex((r) => r.id === role.id);
    if (index !== -1) {
      roles.value[index] = updated;
    }
  } catch (error: any) {
    alert(error.data?.message || 'Failed to update role');
  }
}

async function deleteRole(role: Role) {
  if (!confirm(`Are you sure you want to delete the role "${role.name}"?`))
    return;

  try {
    await $fetch(`/api/admin/roles/${role.id}`, {
      method: 'DELETE',
    });
    roles.value = roles.value.filter((r) => r.id !== role.id);
  } catch (error: any) {
    alert(error.data?.message || 'Failed to delete role');
  }
}

onMounted(() => {
  loadRoles();
});
</script>
