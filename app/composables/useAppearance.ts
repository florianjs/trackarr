import { DEFAULT_APPEARANCE, type Appearance } from '~~/shared/utils/appearance';

/**
 * Site appearance (theme, fonts, login design, images, texts), loaded once by
 * app/plugins/appearance.ts. The admin page writes to it to preview changes.
 */
export function useAppearance() {
  return useState<Appearance>('appearance', () => structuredClone(DEFAULT_APPEARANCE));
}
