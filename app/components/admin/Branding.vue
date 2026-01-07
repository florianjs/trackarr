<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:paint-brush" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Site Branding
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Preview -->
      <div class="p-4 bg-bg-tertiary rounded-lg border border-border mb-6">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
        >
          Live Preview
        </p>
        <div class="flex items-center gap-2.5">
          <div
            class="w-7 h-7 rounded-sm flex items-center justify-center overflow-hidden"
            :style="
              useCustomImage && siteLogoImage
                ? 'background: repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                : 'background: white'
            "
          >
            <img
              v-if="useCustomImage && siteLogoImage"
              :src="siteLogoImage"
              alt="Logo"
              class="w-full h-full object-contain"
              @error="handleImageError"
            />
            <Icon v-else :name="siteLogo" class="text-black text-lg" />
          </div>
          <div class="flex flex-col leading-none">
            <span
              class="text-sm tracking-tighter uppercase transition-colors"
              :class="{
                'font-bold': siteNameBold,
                'font-medium': !siteNameBold,
              }"
              :style="{ color: siteNameColor || '' }"
              v-html="siteName || 'OpenTracker'"
            ></span>
            <span class="text-[10px] text-text-muted font-mono">{{
              siteSubtitle || `v${useRuntimeConfig().public.appVersion}`
            }}</span>
          </div>
        </div>
      </div>

      <!-- Site Name -->
      <SettingsGroup
        label="Site Name"
        description="Displayed in the navbar and browser title. Use rich text for custom styling."
      >
        <WysiwygEditor
          v-model="siteName"
          placeholder="OpenTracker"
          :maxLength="200"
        />

        <div class="flex items-center gap-4 mt-3">
          <!-- Color Picker -->
          <div class="flex items-center gap-2">
            <input
              v-model="siteNameColor"
              type="color"
              class="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              title="Site Name Color"
            />
            <button
              v-if="siteNameColor"
              @click="siteNameColor = null"
              class="text-xs text-text-muted hover:text-text-secondary underline"
            >
              Reset
            </button>
          </div>

          <!-- Bold Toggle -->
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <div
              class="w-10 h-5 bg-bg-tertiary border border-border rounded-full relative transition-colors"
              :class="{ 'bg-success/20 border-success/50': siteNameBold }"
            >
              <div
                class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-text-secondary rounded-full transition-transform"
                :class="{ 'translate-x-[20px] bg-success': siteNameBold }"
              ></div>
            </div>
            <input type="checkbox" v-model="siteNameBold" class="hidden" />
            <span class="text-xs font-medium">Bold</span>
          </label>
        </div>
      </SettingsGroup>

      <!-- Site Subtitle -->
      <SettingsGroup
        label="Subtitle"
        description="Text below site name. Leave empty to show version. Supports rich text."
      >
        <WysiwygEditor
          v-model="siteSubtitle"
          placeholder="Leave empty for version number"
          :maxLength="300"
        />
      </SettingsGroup>

      <!-- Logo Type Toggle -->
      <SettingsGroup
        label="Logo Type"
        description="Choose between a Phosphor icon or a custom image."
      >
        <div class="flex gap-2">
          <button
            @click="useCustomImage = false"
            class="flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded border transition-colors"
            :class="
              !useCustomImage
                ? 'bg-white text-black border-white'
                : 'bg-bg-tertiary border-border text-text-secondary hover:border-white/20'
            "
          >
            <Icon name="ph:phosphor-logo" class="mr-1" /> Icon
          </button>
          <button
            @click="useCustomImage = true"
            class="flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded border transition-colors"
            :class="
              useCustomImage
                ? 'bg-white text-black border-white'
                : 'bg-bg-tertiary border-border text-text-secondary hover:border-white/20'
            "
          >
            <Icon name="ph:image" class="mr-1" /> Image
          </button>
        </div>
      </SettingsGroup>

      <!-- Icon Selection (when useCustomImage is false) -->
      <SettingsGroup
        v-if="!useCustomImage"
        label="Logo Icon"
        description="Use Phosphor icon names (e.g., ph:broadcast-bold)."
      >
        <div class="flex gap-2 mb-3">
          <input
            v-model="siteLogo"
            type="text"
            maxlength="100"
            class="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono"
            placeholder="ph:broadcast-bold"
          />
          <div
            class="w-10 h-10 bg-bg-tertiary border border-border rounded flex items-center justify-center shrink-0"
          >
            <Icon :name="siteLogo" class="text-xl text-text-secondary" />
          </div>
        </div>

        <!-- Common Icons -->
        <div class="mt-4">
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2"
          >
            Quick Select
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="icon in commonIcons"
              :key="icon"
              @click="siteLogo = icon"
              class="w-9 h-9 bg-bg-tertiary border rounded flex items-center justify-center hover:bg-white/5 transition-colors"
              :class="siteLogo === icon ? 'border-white' : 'border-border'"
            >
              <Icon :name="icon" class="text-lg text-text-secondary" />
            </button>
          </div>
        </div>
      </SettingsGroup>

      <!-- Image Upload (when useCustomImage is true) -->
      <SettingsGroup
        v-if="useCustomImage"
        label="Logo Image"
        description="Upload a custom logo (PNG, JPG, SVG, WebP). Max 5MB."
      >
        <!-- Current Image Preview -->
        <div v-if="siteLogoImage" class="mb-3 flex items-center gap-3">
          <div
            class="w-12 h-12 rounded flex items-center justify-center overflow-hidden border border-border"
            style="
              background: repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%)
                50% / 12px 12px;
            "
          >
            <img
              :src="siteLogoImage"
              alt="Current logo"
              class="max-w-full max-h-full object-contain"
              @error="handleImageError"
            />
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] text-text-muted font-mono truncate max-w-[200px]"
              >{{ siteLogoImage }}</span
            >
            <button
              @click="removeImage"
              class="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 w-fit"
            >
              <Icon name="ph:trash" /> Remove
            </button>
          </div>
        </div>

        <!-- Upload Input -->
        <div
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
          class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer group"
          :class="
            dragOver
              ? 'border-white bg-white/5'
              : 'border-border hover:border-white/30 hover:bg-bg-tertiary/50'
          "
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            class="hidden"
            @change="handleFileSelect"
          />
          <Icon
            name="ph:upload-simple"
            class="text-2xl text-text-muted mb-2 group-hover:text-text-primary transition-colors"
          />
          <p
            class="text-xs text-text-muted group-hover:text-text-primary transition-colors"
          >
            {{ uploading ? 'Uploading...' : 'Drop image or click to upload' }}
          </p>
        </div>
      </SettingsGroup>

      <!-- Favicon Upload -->
      <SettingsGroup
        label="Favicon"
        description="Upload a custom favicon (ICO, PNG, SVG). Max 1MB. Shown in browser tabs."
      >
        <!-- Current Favicon Preview -->
        <div v-if="siteFavicon" class="mb-3 flex items-center gap-3">
          <div
            class="w-12 h-12 rounded flex items-center justify-center overflow-hidden border border-border"
            style="
              background: repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%)
                50% / 12px 12px;
            "
          >
            <img
              :src="siteFavicon"
              alt="Current favicon"
              class="max-w-full max-h-full object-contain"
              @error="handleFaviconError"
            />
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] text-text-muted font-mono truncate max-w-[200px]"
              >{{ siteFavicon }}</span
            >
            <button
              @click="removeFavicon"
              class="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 w-fit"
            >
              <Icon name="ph:trash" /> Remove
            </button>
          </div>
        </div>

        <!-- Upload Input -->
        <div
          @dragover.prevent="dragOverFavicon = true"
          @dragleave="dragOverFavicon = false"
          @drop.prevent="handleFaviconDrop"
          class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer group"
          :class="
            dragOverFavicon
              ? 'border-white bg-white/5'
              : 'border-border hover:border-white/30 hover:bg-bg-tertiary/50'
          "
          @click="triggerFaviconInput"
        >
          <input
            ref="faviconInput"
            type="file"
            accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/webp"
            class="hidden"
            @change="handleFaviconSelect"
          />
          <Icon
            name="ph:browser"
            class="text-2xl text-text-muted mb-2 group-hover:text-text-primary transition-colors"
          />
          <p
            class="text-xs text-text-muted group-hover:text-text-primary transition-colors"
          >
            {{
              uploadingFavicon
                ? 'Uploading...'
                : 'Drop favicon or click to upload'
            }}
          </p>
        </div>
      </SettingsGroup>

      <!-- Save Button -->
      <button
        @click="saveBranding"
        :disabled="loading || saved"
        class="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        :class="
          saved
            ? 'bg-success text-white'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon v-if="loading" name="ph:circle-notch" class="animate-spin" />
        <Icon v-else-if="saved" name="ph:check-bold" />
        {{ loading ? 'Saving...' : saved ? 'Saved' : 'Save Branding' }}
      </button>
    </div>
  </div>

  <!-- Extended Text Branding -->
  <div class="card mt-6">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:text-aa" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Text Branding
        </h3>
      </div>
      <p class="text-xs text-text-muted mt-1">
        Customize text that appears throughout the site. Use the rich text
        editor for advanced formatting.
      </p>
    </div>
    <div class="card-body space-y-6">
      <!-- Auth Page Title -->
      <SettingsGroup
        label="Auth Page Title"
        description="Title shown on login/register pages. Leave empty to use Site Name."
      >
        <WysiwygEditor
          v-model="authTitle"
          placeholder="Enter auth page title..."
          :maxLength="200"
        />
      </SettingsGroup>

      <!-- Auth Page Subtitle -->
      <SettingsGroup
        label="Auth Page Subtitle"
        description="Subtitle shown below the title on login/register pages."
      >
        <WysiwygEditor
          v-model="authSubtitle"
          placeholder="Private BitTorrent Tracker"
          :maxLength="500"
        />
      </SettingsGroup>

      <!-- Footer Text -->
      <SettingsGroup
        label="Footer Content"
        description="Custom footer content. Supports rich text formatting."
      >
        <WysiwygEditor
          v-model="footerText"
          :placeholder="`© ${new Date().getFullYear()} ${(siteName || 'OpenTracker').toUpperCase()}`"
          :maxLength="500"
        />
      </SettingsGroup>

      <!-- Page Title Suffix -->
      <SettingsGroup
        label="Page Title Suffix"
        description="Text appended to browser tab titles. Plain text only."
      >
        <div class="space-y-2">
          <input
            v-model="pageTitleSuffix"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="`- ${siteName || 'OpenTracker'}`"
          />
          <p class="text-[10px] text-text-muted">
            Example: "Search Torrents{{
              pageTitleSuffix || ` - ${siteName || 'OpenTracker'}`
            }}"
          </p>
        </div>
      </SettingsGroup>

      <!-- Welcome Message -->
      <SettingsGroup
        label="Welcome Message"
        description="Rich text message displayed on the homepage or dashboard."
      >
        <WysiwygEditor
          v-model="welcomeMessage"
          placeholder="Welcome to our tracker community..."
          :maxLength="2000"
        />
      </SettingsGroup>

      <!-- Rules / Terms -->
      <SettingsGroup
        label="Site Rules"
        description="Rules and terms displayed to users. Supports full rich text."
      >
        <WysiwygEditor
          v-model="siteRules"
          placeholder="Enter site rules and guidelines..."
          :maxLength="10000"
        />
      </SettingsGroup>

      <!-- Save Button -->
      <button
        @click="saveTextBranding"
        :disabled="loadingText || savedText"
        class="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        :class="
          savedText
            ? 'bg-success text-white'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon v-if="loadingText" name="ph:circle-notch" class="animate-spin" />
        <Icon v-else-if="savedText" name="ph:check-bold" />
        {{
          loadingText ? 'Saving...' : savedText ? 'Saved' : 'Save Text Branding'
        }}
      </button>
    </div>
  </div>

  <!-- Homepage Content -->
  <div class="card mt-6">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:house" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Homepage Content
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Hero Section -->
      <div class="space-y-4">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          Hero Section
        </p>

        <SettingsGroup
          label="Title"
          description="The main headline on the homepage. Use rich text for custom styling, colors, and fonts."
        >
          <WysiwygEditor
            v-model="heroTitle"
            placeholder="OpenTracker"
            :maxLength="500"
          />
        </SettingsGroup>

        <SettingsGroup
          label="Subtitle"
          description="A short description below the title. Supports rich text."
        >
          <WysiwygEditor
            v-model="heroSubtitle"
            placeholder="High-performance, minimalist P2P tracking engine..."
            :maxLength="1000"
          />
        </SettingsGroup>

        <SettingsGroup
          label="Status Badge"
          description="Text shown in the pill badge above the title."
        >
          <input
            v-model="statusBadgeText"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            placeholder="Tracker Online & Operational"
          />
        </SettingsGroup>
      </div>

      <!-- Feature Boxes -->
      <div class="space-y-4 pt-4 border-t border-border">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          Feature Boxes
        </p>

        <SettingsGroup
          v-for="(feature, index) in features"
          :key="index"
          :label="`Feature ${index + 1}`"
          description="Title and description for this feature card. Supports rich text."
        >
          <div class="space-y-3">
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >Title</label
              >
              <WysiwygEditor
                v-model="feature.title"
                placeholder="Feature title"
                :maxLength="300"
              />
            </div>
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >Description</label
              >
              <WysiwygEditor
                v-model="feature.description"
                placeholder="Feature description..."
                :maxLength="1000"
              />
            </div>
          </div>
        </SettingsGroup>
      </div>

      <!-- Save Button -->
      <button
        @click="saveHomepageContent"
        :disabled="loadingHomepage || savedHomepage"
        class="w-full text-[10px] font-bold uppercase tracking-widest py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        :class="
          savedHomepage
            ? 'bg-success text-white'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon
          v-if="loadingHomepage"
          name="ph:circle-notch"
          class="animate-spin"
        />
        <Icon v-else-if="savedHomepage" name="ph:check-bold" />
        {{
          loadingHomepage
            ? 'Saving...'
            : savedHomepage
              ? 'Saved'
              : 'Save Homepage Content'
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const siteName = ref<string>('OpenTracker');
const siteLogo = ref('ph:broadcast-bold');
const siteLogoImage = ref<string | null>(null);
const siteSubtitle = ref<string>('');
const siteNameColor = ref<string | null>(null);
const siteNameBold = ref(true);
const useCustomImage = ref(false);
const loading = ref(false);
const saved = ref(false);
const uploading = ref(false);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Favicon
const siteFavicon = ref<string | null>(null);
const uploadingFavicon = ref(false);
const dragOverFavicon = ref(false);
const faviconInput = ref<HTMLInputElement | null>(null);

// Extended text branding
const authTitle = ref<string>('');
const authSubtitle = ref<string>('');
const footerText = ref<string>('');
const pageTitleSuffix = ref<string>('');
const welcomeMessage = ref<string>('');
const siteRules = ref<string>('');
const loadingText = ref(false);
const savedText = ref(false);

// Homepage content
const heroTitle = ref('OpenTracker');
const heroSubtitle = ref(
  'High-performance, minimalist P2P tracking engine. Search through our indexed database of verified torrents.'
);
const statusBadgeText = ref('Tracker Online & Operational');
const features = ref([
  {
    title: 'High Performance',
    description:
      'Built with Node.js and Redis for sub-millisecond response times and high concurrency support.',
  },
  {
    title: 'Multi-Protocol',
    description:
      'Supports HTTP, UDP, and WebSocket protocols for maximum compatibility with all BitTorrent clients.',
  },
  {
    title: 'Open Source',
    description:
      'Fully transparent and community-driven. Designed for privacy and efficiency in the P2P ecosystem.',
  },
]);
const loadingHomepage = ref(false);
const savedHomepage = ref(false);

const commonIcons = [
  'ph:broadcast-bold',
  'ph:globe',
  'ph:rocket',
  'ph:lightning',
  'ph:fire',
  'ph:star',
  'ph:planet',
  'ph:atom',
  'ph:cube',
  'ph:diamond',
  'ph:crown',
  'ph:shield-check',
];

onMounted(async () => {
  try {
    const settings = await $fetch<{
      siteName: string;
      siteLogo: string;
      siteLogoImage: string | null;
      siteFavicon: string | null;
      siteSubtitle: string | null;
      siteNameColor: string | null;
      siteNameBold: boolean | undefined;
      authTitle: string | null;
      authSubtitle: string | null;
      footerText: string | null;
      pageTitleSuffix: string | null;
      welcomeMessage: string | null;
      siteRules: string | null;
      heroTitle: string;
      heroSubtitle: string;
      statusBadgeText: string;
      feature1Title: string;
      feature1Desc: string;
      feature2Title: string;
      feature2Desc: string;
      feature3Title: string;
      feature3Desc: string;
    }>('/api/admin/settings');
    siteName.value = settings.siteName || 'OpenTracker';
    siteLogo.value = settings.siteLogo;
    siteLogoImage.value = settings.siteLogoImage;
    siteFavicon.value = settings.siteFavicon;
    siteSubtitle.value = settings.siteSubtitle || '';
    siteNameColor.value = settings.siteNameColor;
    siteNameBold.value = settings.siteNameBold ?? true;
    useCustomImage.value = !!settings.siteLogoImage;
    // Extended text branding
    authTitle.value = settings.authTitle || '';
    authSubtitle.value = settings.authSubtitle || '';
    footerText.value = settings.footerText || '';
    pageTitleSuffix.value = settings.pageTitleSuffix || '';
    welcomeMessage.value = settings.welcomeMessage || '';
    siteRules.value = settings.siteRules || '';
    // Homepage content
    heroTitle.value = settings.heroTitle || 'OpenTracker';
    heroSubtitle.value = settings.heroSubtitle || heroSubtitle.value;
    statusBadgeText.value =
      settings.statusBadgeText || 'Tracker Online & Operational';
    features.value = [
      {
        title: settings.feature1Title || features.value[0]?.title || '',
        description:
          settings.feature1Desc || features.value[0]?.description || '',
      },
      {
        title: settings.feature2Title || features.value[1]?.title || '',
        description:
          settings.feature2Desc || features.value[1]?.description || '',
      },
      {
        title: settings.feature3Title || features.value[2]?.title || '',
        description:
          settings.feature3Desc || features.value[2]?.description || '',
      },
    ];
  } catch (error) {
    console.error('Failed to load branding settings:', error);
  }
});

function triggerFileInput() {
  fileInput.value?.click();
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) uploadFile(file);
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadFile(file);
  input.value = '';
}

async function uploadFile(file: File) {
  if (uploading.value) return;

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('logo', file);

    const result = await $fetch<{ url: string }>('/api/admin/logo', {
      method: 'POST',
      body: formData,
    });

    siteLogoImage.value = result.url;
  } catch (error: any) {
    console.error('Failed to upload logo:', error);
    if (error.data) {
      console.error('Server error details:', error.data);
    }
  } finally {
    uploading.value = false;
  }
}

function handleImageError(e: Event) {
  console.error('Failed to load logo image:', siteLogoImage.value);
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
}

function removeImage() {
  siteLogoImage.value = null;
}

// Favicon functions
function triggerFaviconInput() {
  faviconInput.value?.click();
}

function handleFaviconDrop(e: DragEvent) {
  dragOverFavicon.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) uploadFavicon(file);
}

function handleFaviconSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadFavicon(file);
  input.value = '';
}

async function uploadFavicon(file: File) {
  if (uploadingFavicon.value) return;

  uploadingFavicon.value = true;
  try {
    const formData = new FormData();
    formData.append('favicon', file);

    const result = await $fetch<{ url: string }>('/api/admin/favicon', {
      method: 'POST',
      body: formData,
    });

    siteFavicon.value = result.url;
  } catch (error: any) {
    console.error('Failed to upload favicon:', error);
    if (error.data) {
      console.error('Server error details:', error.data);
    }
  } finally {
    uploadingFavicon.value = false;
  }
}

function handleFaviconError(e: Event) {
  console.error('Failed to load favicon:', siteFavicon.value);
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
}

function removeFavicon() {
  siteFavicon.value = null;
}

async function saveBranding() {
  loading.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        siteName: siteName.value,
        siteLogo: siteLogo.value,
        siteLogoImage: useCustomImage.value ? siteLogoImage.value : null,
        siteSubtitle: siteSubtitle.value || null,
        siteNameColor: siteNameColor.value || null,
        siteNameBold: siteNameBold.value,
      },
    });
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save branding:', error);
  } finally {
    loading.value = false;
  }
}

async function saveTextBranding() {
  loadingText.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        authTitle: authTitle.value || null,
        authSubtitle: authSubtitle.value || null,
        footerText: footerText.value || null,
        pageTitleSuffix: pageTitleSuffix.value || null,
        welcomeMessage: welcomeMessage.value || null,
        siteRules: siteRules.value || null,
      },
    });
    savedText.value = true;
    setTimeout(() => {
      savedText.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save text branding:', error);
  } finally {
    loadingText.value = false;
  }
}

async function saveHomepageContent() {
  loadingHomepage.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        heroTitle: heroTitle.value,
        heroSubtitle: heroSubtitle.value,
        statusBadgeText: statusBadgeText.value,
        feature1Title: features.value[0]?.title ?? '',
        feature1Desc: features.value[0]?.description ?? '',
        feature2Title: features.value[1]?.title ?? '',
        feature2Desc: features.value[1]?.description ?? '',
        feature3Title: features.value[2]?.title ?? '',
        feature3Desc: features.value[2]?.description ?? '',
      },
    });
    savedHomepage.value = true;
    setTimeout(() => {
      savedHomepage.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to save homepage content:', error);
  } finally {
    loadingHomepage.value = false;
  }
}
</script>
