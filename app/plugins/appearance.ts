import { buildOverrideTree, buildThemeCss, type Appearance } from '~~/shared/utils/appearance';

/**
 * Applies the admin appearance on every page: a <style> with the theme
 * variables (rendered on the server, so no flash) and the text overrides
 * merged into vue-i18n, for the current locale and each one switched to.
 */
export default defineNuxtPlugin({
  name: 'trackarr:appearance',
  dependsOn: ['i18n:plugin', 'trackarr:locale-cookie'],
  async setup(nuxtApp) {
    const appearance = useAppearance();
    const { data } = await useAsyncData('appearance', () => $fetch<Appearance>('/api/appearance'));
    if (data.value) appearance.value = data.value;

    useHead({
      style: [{ key: 'appearance', textContent: computed(() => buildThemeCss(appearance.value)) }],
    });

    const i18n = nuxtApp.$i18n;
    const applyTexts = (locale: string) => {
      const texts = appearance.value.texts[locale as keyof Appearance['texts']];
      if (!texts) return;
      // Message functions, not strings: no message compiler involved
      i18n.mergeLocaleMessage(locale, buildOverrideTree(texts) as never);
    };
    applyTexts(i18n.locale.value);
    nuxtApp.hook('i18n:localeSwitched', ({ newLocale }) => applyTexts(newLocale));
  },
});
