<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:paint-brush" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          {{ t('admin.branding.title') }}
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Preview -->
      <div class="p-4 bg-bg-tertiary rounded-lg border border-border mb-6">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3"
        >
          {{ t('admin.branding.livePreview') }}
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
              class="text-sm tracking-tighter transition-colors"
              :class="{
                'font-bold': siteNameBold,
                'font-medium': !siteNameBold,
              }"
              :style="{ color: siteNameColor || '' }"
              v-html="siteName"
            ></span>
            <span class="text-[10px] text-text-muted font-mono"
              v-html="siteSubtitle"
            ></span>
          </div>
        </div>
      </div>

      <!-- Site Name -->
      <SettingsGroup
        :label="t('admin.branding.siteName')"
        :description="t('admin.branding.siteNameDescription')"
      >
        <WysiwygEditor
          v-model="siteName"
          placeholder="Trackarr"
          :maxLength="200"
        />

        <div class="flex items-center gap-4 mt-3">
          <!-- Color Picker -->
          <div class="flex items-center gap-2">
            <input
              v-model="siteNameColor"
              type="color"
              class="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              :title="t('admin.branding.siteNameColor')"
            />
            <button
              v-if="siteNameColor"
              @click="siteNameColor = null"
              class="text-xs text-text-muted hover:text-text-secondary underline"
            >
              {{ t('common.reset') }}
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
            <span class="text-xs font-medium">{{ t('admin.branding.bold') }}</span>
          </label>
        </div>
      </SettingsGroup>

      <!-- Site Subtitle -->
      <SettingsGroup
        :label="t('admin.branding.subtitle')"
        :description="t('admin.branding.subtitleDescription')"
      >
        <WysiwygEditor
          v-model="siteSubtitle"
          :placeholder="t('admin.branding.subtitlePlaceholder')"
          :maxLength="300"
        />
      </SettingsGroup>

      <!-- Logo Type Toggle -->
      <SettingsGroup
        :label="t('admin.branding.logoType')"
        :description="t('admin.branding.logoTypeDescription')"
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
            <Icon name="ph:phosphor-logo" class="mr-1" /> {{ t('admin.branding.icon') }}
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
            <Icon name="ph:image" class="mr-1" /> {{ t('admin.branding.image') }}
          </button>
        </div>
      </SettingsGroup>

      <!-- Icon Selection (when useCustomImage is false) -->
      <SettingsGroup
        v-if="!useCustomImage"
        :label="t('admin.branding.logoIcon')"
        :description="t('admin.branding.logoIconDescription')"
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
            {{ t('admin.branding.quickSelect') }}
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
        :label="t('admin.branding.logoImage')"
        :description="t('admin.branding.logoImageDescription')"
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
              :alt="t('admin.branding.currentLogo')"
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
              <Icon name="ph:trash" /> {{ t('common.remove') }}
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
            {{ uploading ? t('admin.branding.uploading') : t('admin.branding.dropImage') }}
          </p>
        </div>
      </SettingsGroup>

      <!-- Favicon Upload -->
      <SettingsGroup
        :label="t('admin.branding.favicon')"
        :description="t('admin.branding.faviconDescription')"
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
              :alt="t('admin.branding.currentFavicon')"
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
              <Icon name="ph:trash" /> {{ t('common.remove') }}
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
                ? t('admin.branding.uploading')
                : t('admin.branding.dropFavicon')
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
            ? 'bg-success text-paper'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon v-if="loading" name="ph:circle-notch" class="animate-spin" />
        <Icon v-else-if="saved" name="ph:check-bold" />
        {{
          loading
            ? t('common.saving')
            : saved
              ? t('common.saved')
              : t('admin.branding.saveBranding')
        }}
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
          {{ t('admin.branding.textBranding') }}
        </h3>
      </div>
      <p class="text-xs text-text-muted mt-1">
        {{ t('admin.branding.textBrandingDescription') }}
      </p>
    </div>
    <div class="card-body space-y-6">
      <!-- Auth Page Title -->
      <SettingsGroup
        :label="t('admin.branding.authTitle')"
        :description="t('admin.branding.authTitleDescription')"
      >
        <WysiwygEditor
          v-model="authTitle"
          :placeholder="t('admin.branding.authTitlePlaceholder')"
          :maxLength="200"
        />
      </SettingsGroup>

      <!-- Auth Page Subtitle -->
      <SettingsGroup
        :label="t('admin.branding.authSubtitle')"
        :description="t('admin.branding.authSubtitleDescription')"
      >
        <WysiwygEditor
          v-model="authSubtitle"
          :placeholder="t('admin.branding.authSubtitlePlaceholder')"
          :maxLength="500"
        />
      </SettingsGroup>

      <!-- Footer Text -->
      <SettingsGroup
        :label="t('admin.branding.footerContent')"
        :description="t('admin.branding.footerContentDescription')"
      >
        <WysiwygEditor
          v-model="footerText"
          :placeholder="`© ${new Date().getFullYear()} ${(siteName || 'Trackarr').toUpperCase()}`"
          :maxLength="500"
        />
      </SettingsGroup>

      <!-- Page Title Suffix -->
      <SettingsGroup
        :label="t('admin.branding.pageTitleSuffix')"
        :description="t('admin.branding.pageTitleSuffixDescription')"
      >
        <div class="space-y-2">
          <input
            v-model="pageTitleSuffix"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="`- ${siteName?.replace(/<[^>]*>/g, '') || 'Trackarr'}`"
          />
          <p class="text-[10px] text-text-muted">
            {{
              t('admin.branding.pageTitleExample', {
                title:
                  pageTitleSuffix ||
                  ` - ${siteName?.replace(/<[^>]*>/g, '') || 'Trackarr'}`,
              })
            }}
          </p>
        </div>
      </SettingsGroup>

      <!-- Welcome Message -->
      <SettingsGroup
        :label="t('admin.branding.welcomeMessage')"
        :description="t('admin.branding.welcomeMessageDescription')"
      >
        <WysiwygEditor
          v-model="welcomeMessage"
          :placeholder="t('admin.branding.welcomeMessagePlaceholder')"
          :maxLength="2000"
        />
      </SettingsGroup>

      <!-- Rules / Terms -->
      <SettingsGroup
        :label="t('admin.branding.siteRules')"
        :description="t('admin.branding.siteRulesDescription')"
      >
        <WysiwygEditor
          v-model="siteRules"
          :placeholder="t('admin.branding.siteRulesPlaceholder')"
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
            ? 'bg-success text-paper'
            : 'bg-text-primary text-bg-primary hover:opacity-90'
        "
      >
        <Icon v-if="loadingText" name="ph:circle-notch" class="animate-spin" />
        <Icon v-else-if="savedText" name="ph:check-bold" />
        {{
          loadingText
            ? t('common.saving')
            : savedText
              ? t('common.saved')
              : t('admin.branding.saveTextBranding')
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
          {{ t('admin.branding.homepageContent') }}
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Hero Section -->
      <div class="space-y-4">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          {{ t('admin.branding.heroSection') }}
        </p>

        <SettingsGroup
          :label="t('admin.branding.heroTitle')"
          :description="t('admin.branding.heroTitleDescription')"
        >
          <WysiwygEditor
            v-model="heroTitle"
            :placeholder="t('admin.branding.heroTitlePlaceholder')"
            :maxLength="500"
          />
        </SettingsGroup>

        <SettingsGroup
          :label="t('admin.branding.subtitle')"
          :description="t('admin.branding.heroSubtitleDescription')"
        >
          <WysiwygEditor
            v-model="heroSubtitle"
            :placeholder="t('admin.branding.heroSubtitlePlaceholder')"
            :maxLength="1000"
          />
        </SettingsGroup>

        <SettingsGroup
          :label="t('admin.branding.statusBadge')"
          :description="t('admin.branding.statusBadgeDescription')"
        >
          <input
            v-model="statusBadgeText"
            type="text"
            maxlength="100"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20"
            :placeholder="t('admin.branding.statusBadgePlaceholder')"
          />
        </SettingsGroup>
      </div>

      <!-- Feature Boxes -->
      <div class="space-y-4 pt-4 border-t border-border">
        <p
          class="text-[10px] font-bold uppercase tracking-widest text-text-muted"
        >
          {{ t('admin.branding.featureBoxes') }}
        </p>

        <SettingsGroup
          v-for="(feature, index) in features"
          :key="index"
          :label="t('admin.branding.feature', { n: index + 1 })"
          :description="t('admin.branding.featureDescription')"
        >
          <div class="space-y-3">
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >{{ t('admin.branding.featureTitle') }}</label
              >
              <WysiwygEditor
                v-model="feature.title"
                :placeholder="t('admin.branding.featureTitlePlaceholder')"
                :maxLength="300"
              />
            </div>
            <div>
              <label
                class="text-[10px] text-text-muted uppercase tracking-wider mb-1 block"
                >{{ t('common.description') }}</label
              >
              <WysiwygEditor
                v-model="feature.description"
                :placeholder="t('admin.branding.featureDescriptionPlaceholder')"
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
            ? 'bg-success text-paper'
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
            ? t('common.saving')
            : savedHomepage
              ? t('common.saved')
              : t('admin.branding.saveHomepageContent')
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

const siteName = ref<string>('Trackarr');
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
const heroTitle = ref('Trackarr');
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
    siteName.value = settings.siteName || 'Trackarr';
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
    heroTitle.value = settings.heroTitle || 'Trackarr';
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
