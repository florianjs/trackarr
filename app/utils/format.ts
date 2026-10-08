// Resolve the active i18n instance when called from a component/render context;
// outside of a Nuxt app (e.g. unit tests) fall back to English output
function getI18n() {
  return tryUseNuxtApp()?.$i18n;
}

// Identity helper so key literals stay greppable by i18n tooling
const i18nKey = (key: string) => key;

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(getI18n()?.locale.value ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const i18n = getI18n();
  const ago = (key: string, count: number, fallback: string) =>
    i18n ? i18n.t(key, { count }, count) : fallback;

  if (diffInSeconds < 60) return i18n ? i18n.t('time.justNow') : 'just now';
  if (diffInSeconds < 3600) {
    const n = Math.floor(diffInSeconds / 60);
    return ago(i18nKey('time.minutesAgo'), n, `${n}m ago`);
  }
  if (diffInSeconds < 86400) {
    const n = Math.floor(diffInSeconds / 3600);
    return ago(i18nKey('time.hoursAgo'), n, `${n}h ago`);
  }
  if (diffInSeconds < 2592000) {
    const n = Math.floor(diffInSeconds / 86400);
    return ago(i18nKey('time.daysAgo'), n, `${n}d ago`);
  }
  if (diffInSeconds < 31536000) {
    const n = Math.floor(diffInSeconds / 2592000);
    return ago(i18nKey('time.monthsAgo'), n, `${n}mo ago`);
  }
  const n = Math.floor(diffInSeconds / 31536000);
  return ago(i18nKey('time.yearsAgo'), n, `${n}y ago`);
}
