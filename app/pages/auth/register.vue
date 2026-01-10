<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden"
        >
          <img
            v-if="branding?.siteLogoImage"
            :src="branding.siteLogoImage"
            alt="Logo"
            class="w-full h-full object-contain"
          />
          <Icon
            v-else
            :name="branding?.siteLogo || 'ph:broadcast-bold'"
            class="text-black text-4xl"
          />
        </div>
        <h1
          class="text-2xl font-bold tracking-tighter"
          v-html="branding?.authTitle || branding?.siteName || 'TRACKARR'"
        ></h1>
        <div
          class="text-text-muted text-sm mt-1 [&>p]:m-0"
          v-html="branding?.authSubtitle || 'Private BitTorrent Tracker'"
        ></div>
      </div>

      <!-- Registration Closed -->
      <div
        v-if="
          !status?.registrationOpen &&
          !status?.inviteEnabled &&
          !status?.needsSetup
        "
        class="bg-bg-secondary border border-border rounded-lg p-6 text-center"
      >
        <Icon
          name="ph:lock-simple"
          class="text-4xl text-text-muted mx-auto mb-4"
        />
        <h2 class="text-lg font-semibold mb-2">Registration Closed</h2>
        <p class="text-text-muted text-sm mb-6">
          New registrations are currently not accepted. If you have an invite,
          please contact an administrator.
        </p>
        <NuxtLink
          to="/auth/login"
          class="inline-block bg-white text-black font-medium px-6 py-2 rounded hover:bg-gray-200 transition-colors"
        >
          Sign In
        </NuxtLink>
      </div>

      <!-- Register Form -->
      <div v-else class="bg-bg-secondary border border-border rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-6">
          {{
            status?.needsSetup
              ? 'Create Admin Account'
              : !status?.registrationOpen && status?.inviteEnabled
                ? 'Invite Only Registration'
                : 'Create Account'
          }}
        </h2>

        <div
          v-if="status?.needsSetup"
          class="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded"
        >
          <p class="text-amber-400 text-sm">
            <Icon name="ph:warning" class="inline mr-1" />
            This is the first account. It will have administrator privileges.
          </p>
        </div>

        <!-- ZKE Warning -->
        <div class="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded">
          <p class="text-red-400 text-sm">
            <Icon name="ph:shield-warning" class="inline mr-1" />
            <strong>Zero Knowledge Encryption:</strong> Your password is never
            sent to the server. If you forget it, your account cannot be
            recovered.
          </p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <!-- Invite Code (Required if registration closed) -->
          <div v-if="status?.inviteEnabled">
            <label
              for="inviteCode"
              class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
            >
              Invite Code
              <span
                v-if="status?.registrationOpen"
                class="text-text-muted/50 normal-case tracking-normal ml-1"
              >
                (Optional)
              </span>
            </label>
            <input
              id="inviteCode"
              v-model="form.inviteCode"
              type="text"
              :required="!status?.registrationOpen"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors font-mono"
              placeholder="Enter your invite code"
            />
          </div>

          <div>
            <label
              for="username"
              class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
            >
              Username
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              autocomplete="username"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              placeholder="3-20 characters, letters, numbers, _ or -"
            />
          </div>

          <div>
            <label
              for="password"
              class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              autocomplete="new-password"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              for="confirmPassword"
              class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
              placeholder="Re-enter your password"
            />
          </div>

          <!-- Panic Password (First Admin Only) -->
          <div
            v-if="status?.needsSetup"
            class="pt-4 mt-4 border-t border-border"
          >
            <div
              class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded"
            >
              <p class="text-red-400 text-sm">
                <Icon name="ph:shield-warning" class="inline mr-1" />
                The panic password enables emergency database encryption. Store
                it securely — it cannot be recovered or changed.
              </p>
            </div>

            <div class="mb-4">
              <label
                for="panicPassword"
                class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
              >
                Panic Password
              </label>
              <input
                id="panicPassword"
                v-model="form.panicPassword"
                type="password"
                required
                class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                placeholder="At least 12 characters"
              />
            </div>

            <div>
              <label
                for="confirmPanicPassword"
                class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
              >
                Confirm Panic Password
              </label>
              <input
                id="confirmPanicPassword"
                v-model="form.confirmPanicPassword"
                type="password"
                required
                class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                placeholder="Re-enter panic password"
              />
            </div>
          </div>

          <div v-if="error" class="text-red-400 text-sm">
            {{ error }}
          </div>

          <!-- Status indicator for PoW and ZKE processing -->
          <div v-if="authStatus" class="space-y-2">
            <div class="text-text-muted text-xs flex items-center gap-2">
              <Icon name="ph:spinner" class="animate-spin" />
              {{ authStatus }}
            </div>
            <!-- PoW Progress Bar -->
            <div
              v-if="powProgress > 0"
              class="w-full bg-bg-tertiary rounded-full h-1"
            >
              <div
                class="bg-white h-1 rounded-full transition-all duration-300"
                :style="{ width: `${Math.min(powProgress, 100)}%` }"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-white text-black font-medium py-2.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Creating account...</span>
            <span v-else>{{
              status?.needsSetup ? 'Create Admin Account' : 'Create Account'
            }}</span>
          </button>
        </form>

        <div
          v-if="!status?.needsSetup"
          class="mt-6 pt-6 border-t border-border text-center"
        >
          <p class="text-text-muted text-sm">
            Already have an account?
            <NuxtLink
              to="/auth/login"
              class="text-white hover:underline font-medium"
            >
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { generateCredentials, solvePoW } from '~/utils/crypto';

definePageMeta({
  layout: false,
});

const { fetch: fetchSession } = useUserSession();
const router = useRouter();

const { data: status } = await useFetch('/api/auth/status');
const { data: branding } = await useFetch<{
  siteName: string;
  siteLogo: string;
  siteLogoImage: string | null;
  siteFavicon: string | null;
  authTitle: string | null;
  authSubtitle: string | null;
}>('/api/branding');

// Set dynamic favicon
useHead({
  link: [
    {
      rel: 'icon',
      type: computed(() => {
        const url = branding.value?.siteFavicon;
        if (!url) return 'image/x-icon';
        if (url.endsWith('.svg')) return 'image/svg+xml';
        if (url.endsWith('.png')) return 'image/png';
        if (url.endsWith('.webp')) return 'image/webp';
        return 'image/x-icon';
      }),
      href: computed(() => branding.value?.siteFavicon || '/favicon.ico'),
    },
  ],
});

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  panicPassword: '',
  confirmPanicPassword: '',
  inviteCode: '',
});

const error = ref('');
const loading = ref(false);
const authStatus = ref('');
const powProgress = ref(0);

async function handleRegister() {
  error.value = '';
  authStatus.value = '';
  powProgress.value = 0;

  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match';
    return;
  }

  if (form.password.length < 8) {
    error.value = 'Password must be at least 8 characters';
    return;
  }

  // Panic password validation for first admin
  if (status.value?.needsSetup) {
    if (form.panicPassword !== form.confirmPanicPassword) {
      error.value = 'Panic passwords do not match';
      return;
    }
    if (form.panicPassword.length < 12) {
      error.value = 'Panic password must be at least 12 characters';
      return;
    }
  }

  loading.value = true;

  try {
    // Step 1: Get PoW challenge
    authStatus.value = 'Getting challenge...';
    const powChallenge = await $fetch<{
      challenge: string;
      difficulty: number;
    }>('/api/auth/pow');

    // Step 2: Solve Proof of Work (anti-abuse)
    authStatus.value = 'Solving proof of work...';
    const powSolution = await solvePoW(
      powChallenge.challenge,
      powChallenge.difficulty,
      (hashes) => {
        // Estimate progress based on expected hashes (difficulty 5 = ~1M hashes avg)
        const expectedHashes = Math.pow(16, powChallenge.difficulty);
        powProgress.value = Math.min((hashes / expectedHashes) * 100, 95);
      }
    );
    powProgress.value = 100;

    // Step 3: Generate ZKE credentials client-side
    authStatus.value = 'Generating secure credentials...';
    const credentials = await generateCredentials(form.password);

    // Step 4: Register (password never sent to server)
    authStatus.value = 'Creating account...';
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        username: form.username,
        authSalt: credentials.salt,
        authVerifier: credentials.verifier,
        powChallenge: powSolution.challenge,
        powNonce: powSolution.nonce,
        powHash: powSolution.hash,
        inviteCode: form.inviteCode,
        ...(status.value?.needsSetup && { panicPassword: form.panicPassword }),
      },
    });

    // Refresh session and redirect
    await fetchSession();
    router.push('/');
  } catch (err: any) {
    error.value = err.data?.message || 'Registration failed';
  } finally {
    loading.value = false;
    authStatus.value = '';
    powProgress.value = 0;
  }
}
</script>
