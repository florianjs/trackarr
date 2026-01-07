<template>
  <div class="card border-error/30 bg-error/5">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:shield-warning" class="text-error" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Emergency Lockdown
        </h3>
      </div>
    </div>

    <div class="card-body">
      <!-- Not Encrypted State -->
      <div v-if="!isEncrypted">
        <p class="text-text-muted text-sm mb-4">
          Encrypt all sensitive data immediately. This action renders data
          unreadable without the panic password set during first registration.
        </p>

        <button
          @click="showConfirmModal = true"
          :disabled="loading"
          class="w-full bg-error text-white text-sm font-bold uppercase tracking-widest py-3 rounded hover:bg-error/90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon name="ph:lock-simple" />
          PANIC — Encrypt Database
        </button>
      </div>

      <!-- Encrypted State -->
      <div v-else>
        <div
          class="p-4 bg-error/10 border border-error/30 rounded mb-4 flex items-start gap-3"
        >
          <Icon name="ph:warning" class="text-error text-xl mt-0.5" />
          <div>
            <p class="text-error font-semibold">Database is encrypted</p>
            <p class="text-text-muted text-sm mt-1">
              All sensitive data is currently encrypted. Enter the panic
              password to restore access.
            </p>
            <p v-if="encryptedAt" class="text-text-muted text-xs mt-2">
              Encrypted at: {{ new Date(encryptedAt).toLocaleString() }}
            </p>
          </div>
        </div>

        <button
          @click="showRestoreModal = true"
          :disabled="loading"
          class="w-full bg-success text-white text-sm font-bold uppercase tracking-widest py-3 rounded hover:bg-success/90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon name="ph:lock-open" />
          Restore Database
        </button>
      </div>
    </div>

    <!-- Confirm Encryption Modal -->
    <Teleport to="body">
      <div
        v-if="showConfirmModal"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        @click.self="showConfirmModal = false"
      >
        <div
          class="bg-bg-secondary border border-error/30 rounded-lg p-6 max-w-md w-full"
        >
          <div class="flex items-center gap-3 mb-4">
            <Icon name="ph:warning-octagon" class="text-error text-3xl" />
            <h3 class="text-lg font-bold text-text-primary">
              Confirm Database Encryption
            </h3>
          </div>

          <p class="text-text-muted text-sm mb-4">
            This will encrypt all sensitive data in the database. The data will
            be unreadable until restored with the panic password.
          </p>

          <div class="bg-error/10 border border-error/30 rounded p-3 mb-6">
            <p class="text-error text-sm font-medium">
              ⚠️ This action is irreversible without the panic password.
            </p>
          </div>

          <div class="flex gap-3">
            <button
              @click="showConfirmModal = false"
              class="flex-1 bg-bg-tertiary text-text-secondary text-sm font-medium py-2.5 rounded hover:bg-bg-tertiary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="triggerPanic"
              :disabled="loading"
              class="flex-1 bg-error text-white text-sm font-bold py-2.5 rounded hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Icon
                v-if="loading"
                name="ph:circle-notch"
                class="animate-spin"
              />
              {{ loading ? 'Encrypting...' : 'Encrypt Now' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Restore Modal -->
    <Teleport to="body">
      <div
        v-if="showRestoreModal"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        @click.self="showRestoreModal = false"
      >
        <div
          class="bg-bg-secondary border border-success/30 rounded-lg p-6 max-w-md w-full"
        >
          <div class="flex items-center gap-3 mb-4">
            <Icon name="ph:lock-key-open" class="text-success text-3xl" />
            <h3 class="text-lg font-bold text-text-primary">
              Restore Database
            </h3>
          </div>

          <p class="text-text-muted text-sm mb-4">
            Enter the panic password that was set during the first admin
            registration to decrypt and restore all data.
          </p>

          <div class="mb-4">
            <label
              for="panicPassword"
              class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
            >
              Panic Password
            </label>
            <input
              id="panicPassword"
              v-model="panicPassword"
              type="password"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-success transition-colors"
              placeholder="Enter panic password"
              @keyup.enter="restoreDatabase"
            />
          </div>

          <div v-if="error" class="text-error text-sm mb-4">
            {{ error }}
          </div>

          <div class="flex gap-3">
            <button
              @click="showRestoreModal = false"
              class="flex-1 bg-bg-tertiary text-text-secondary text-sm font-medium py-2.5 rounded hover:bg-bg-tertiary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="restoreDatabase"
              :disabled="loading || !panicPassword"
              class="flex-1 bg-success text-white text-sm font-bold py-2.5 rounded hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Icon
                v-if="loading"
                name="ph:circle-notch"
                class="animate-spin"
              />
              {{ loading ? 'Restoring...' : 'Restore' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const isEncrypted = ref(false);
const encryptedAt = ref<string | null>(null);
const loading = ref(false);
const showConfirmModal = ref(false);
const showRestoreModal = ref(false);
const panicPassword = ref('');
const error = ref('');

// Fetch panic state on mount
onMounted(async () => {
  try {
    const state = await $fetch<{ isEncrypted: boolean; encryptedAt: string | null }>(
      '/api/admin/panic'
    );
    isEncrypted.value = state.isEncrypted;
    encryptedAt.value = state.encryptedAt;
  } catch (err) {
    console.error('Failed to fetch panic state:', err);
  }
});

async function triggerPanic() {
  loading.value = true;
  error.value = '';

  try {
    await $fetch('/api/admin/panic/encrypt', {
      method: 'POST',
      body: { confirm: 'ENCRYPT_ALL_DATA' },
    });

    isEncrypted.value = true;
    encryptedAt.value = new Date().toISOString();
    showConfirmModal.value = false;
  } catch (err: any) {
    error.value = err.data?.message || 'Encryption failed';
  } finally {
    loading.value = false;
  }
}

async function restoreDatabase() {
  if (!panicPassword.value) return;

  loading.value = true;
  error.value = '';

  try {
    await $fetch('/api/admin/panic/restore', {
      method: 'POST',
      body: { panicPassword: panicPassword.value },
    });

    isEncrypted.value = false;
    encryptedAt.value = null;
    showRestoreModal.value = false;
    panicPassword.value = '';
  } catch (err: any) {
    error.value = err.data?.message || 'Restore failed';
  } finally {
    loading.value = false;
  }
}
</script>
