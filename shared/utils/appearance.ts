import { z } from 'zod';

/**
 * Admin-defined look of the site: colour tokens, fonts, corner radius, login
 * page design, fixed images and text overrides. Stored as one JSON setting,
 * served by GET /api/appearance and applied by app/plugins/appearance.ts.
 */

// Same names as the CSS variables of app/assets/css/main.css
export const THEME_TOKENS = [
  'bg',
  'surface',
  'raised',
  'hover',
  'line',
  'line-strong',
  'ink',
  'ink-2',
  'ink-3',
  'seed',
  'leech',
  'free',
  'danger',
  'contrast',
  'contrast-inv',
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];
export type Palette = Record<ThemeToken, string>;
export type PaletteOverride = Partial<Palette>;

// Built-in theme, copied from main.css (the CSS keeps it for the first paint)
export const DEFAULT_PALETTES: { light: Palette; dark: Palette } = {
  light: {
    bg: '#f3f4f6',
    surface: '#ffffff',
    raised: '#f7f8fa',
    hover: '#eceef1',
    line: '#dcdfe4',
    'line-strong': '#c3c8d0',
    ink: '#1a1c20',
    'ink-2': '#4f555e',
    'ink-3': '#6b717b',
    seed: '#1d8556',
    leech: '#a86b0c',
    free: '#5b47d6',
    danger: '#c23a33',
    contrast: '#1a1c20',
    'contrast-inv': '#ffffff',
  },
  dark: {
    bg: '#17181b',
    surface: '#1f2125',
    raised: '#282a2f',
    hover: '#2e3036',
    line: '#33363c',
    'line-strong': '#464a52',
    ink: '#eceae5',
    'ink-2': '#a7a6a1',
    'ink-3': '#84857f',
    seed: '#4cb782',
    leech: '#e2a23e',
    free: '#9b8af7',
    danger: '#e6625b',
    contrast: '#f5f4f0',
    'contrast-inv': '#17181b',
  },
};

/** Ready-made themes: overrides of the default palettes */
export const THEME_PRESETS: Record<string, { light: PaletteOverride; dark: PaletteOverride }> = {
  default: { light: {}, dark: {} },
  midnight: {
    light: {
      bg: '#eef1f7',
      raised: '#f5f7fb',
      hover: '#e4e9f2',
      line: '#d5dbe7',
      'line-strong': '#b8c1d3',
      ink: '#141a2a',
      'ink-2': '#475069',
      'ink-3': '#646d85',
      free: '#2f6fe0',
      contrast: '#141a2a',
    },
    dark: {
      bg: '#0f1420',
      surface: '#161c2b',
      raised: '#1d2436',
      hover: '#232b40',
      line: '#2a3349',
      'line-strong': '#3a4560',
      ink: '#e6e9f2',
      'ink-2': '#a3abc2',
      'ink-3': '#7d86a0',
      free: '#6ea8ff',
      contrast: '#eef2fb',
      'contrast-inv': '#0f1420',
    },
  },
  forest: {
    light: {
      bg: '#f1f3ef',
      raised: '#f6f8f4',
      hover: '#e6eae2',
      line: '#d6ddd0',
      'line-strong': '#bcc7b4',
      ink: '#1b211c',
      'ink-2': '#4c5a4f',
      'ink-3': '#66736a',
      free: '#0e7c7b',
      contrast: '#1b211c',
    },
    dark: {
      bg: '#151a17',
      surface: '#1c221e',
      raised: '#232a25',
      hover: '#29312b',
      line: '#313a33',
      'line-strong': '#435046',
      ink: '#e7ece6',
      'ink-2': '#a6b2a8',
      'ink-3': '#818d83',
      free: '#3cc4c0',
      contrast: '#eef3ed',
      'contrast-inv': '#151a17',
    },
  },
  sunset: {
    light: {
      bg: '#f7f3ef',
      surface: '#fffdfb',
      raised: '#faf6f2',
      hover: '#f0e9e2',
      line: '#e5dbd1',
      'line-strong': '#cfc1b3',
      ink: '#2a1f1a',
      'ink-2': '#5f4f45',
      'ink-3': '#7a685c',
      free: '#c43d52',
      contrast: '#2a1f1a',
      'contrast-inv': '#fffdfb',
    },
    dark: {
      bg: '#1c1714',
      surface: '#241e1a',
      raised: '#2c2520',
      hover: '#332b25',
      line: '#3b322b',
      'line-strong': '#51453c',
      ink: '#f2e9e1',
      'ink-2': '#bba99b',
      'ink-3': '#94857a',
      free: '#f07a8a',
      contrast: '#f7efe8',
      'contrast-inv': '#1c1714',
    },
  },
  mono: {
    light: { free: '#4a505a' },
    dark: { free: '#c9c9c4' },
  },
  contrast: {
    light: {
      bg: '#ffffff',
      raised: '#f2f2f2',
      hover: '#e6e6e6',
      line: '#8a8a8a',
      'line-strong': '#4a4a4a',
      ink: '#000000',
      'ink-2': '#1f1f1f',
      'ink-3': '#3d3d3d',
      free: '#3b1fd1',
      contrast: '#000000',
    },
    dark: {
      bg: '#000000',
      surface: '#0b0b0b',
      raised: '#161616',
      hover: '#1f1f1f',
      line: '#6b6b6b',
      'line-strong': '#9a9a9a',
      ink: '#ffffff',
      'ink-2': '#e6e6e6',
      'ink-3': '#c2c2c2',
      free: '#b4a6ff',
      contrast: '#ffffff',
      'contrast-inv': '#000000',
    },
  },
};
export const PRESET_IDS = Object.keys(THEME_PRESETS) as [string, ...string[]];

// Fonts bundled with the app (the CSP only allows same-origin fonts),
// imported in main.css. Browsers only download the ones in use.
export const SANS_FONTS = {
  plex: '"IBM Plex Sans", system-ui, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  grotesk: '"Space Grotesk", system-ui, sans-serif',
  nunito: '"Nunito", system-ui, sans-serif',
  serif: '"Source Serif 4", Georgia, serif',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;
export const MONO_FONTS = {
  plex: '"IBM Plex Mono", ui-monospace, monospace',
  jetbrains: '"JetBrains Mono", ui-monospace, monospace',
  system: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;
type SansFont = keyof typeof SANS_FONTS;
type MonoFont = keyof typeof MONO_FONTS;
const SANS_IDS = Object.keys(SANS_FONTS) as [SansFont, ...SansFont[]];
const MONO_IDS = Object.keys(MONO_FONTS) as [MonoFont, ...MonoFont[]];

export const RADII = {
  none: '0rem',
  small: '0.1875rem',
  default: '0.3125rem',
  large: '0.5rem',
  round: '0.75rem',
} as const;
type Radius = keyof typeof RADII;
const RADIUS_IDS = Object.keys(RADII) as [Radius, ...Radius[]];

export const LOGIN_LAYOUTS = ['centered', 'split', 'background', 'minimal'] as const;
export type LoginLayout = (typeof LOGIN_LAYOUTS)[number];

export const APPEARANCE_LOCALES = ['en', 'fr', 'es', 'de', 'it', 'zh', 'ja', 'ru'] as const;

export const MAX_TEXT_OVERRIDE_LENGTH = 2000;
const TEXT_KEY_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+){0,8}$/;
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/** Dotted locale key, without segments that would reach Object.prototype */
export function isTextKey(key: string): boolean {
  return TEXT_KEY_RE.test(key) && !key.split('.').some((part) => FORBIDDEN_SEGMENTS.has(part));
}

// Images uploaded through POST /api/admin/appearance/image only
export const APPEARANCE_IMAGE_RE = /^\/uploads\/appearance-[a-f0-9]{16}\.(png|jpg|webp)$/;
export const APPEARANCE_IMAGE_SLOTS = ['loginImage', 'homeBanner'] as const;
export type AppearanceImageSlot = (typeof APPEARANCE_IMAGE_SLOTS)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i).transform((v) => v.toLowerCase());
const paletteOverrideSchema = z
  .object(Object.fromEntries(THEME_TOKENS.map((t) => [t, hex.optional()])) as Record<ThemeToken, z.ZodOptional<typeof hex>>)
  .strict();
const imageSchema = z.string().regex(APPEARANCE_IMAGE_RE).nullable();

const sections = {
  preset: z.enum(PRESET_IDS),
  colors: z.object({ light: paletteOverrideSchema, dark: paletteOverrideSchema }),
  fonts: z.object({ sans: z.enum(SANS_IDS), heading: z.enum(SANS_IDS), mono: z.enum(MONO_IDS) }),
  radius: z.enum(RADIUS_IDS),
  login: z.object({ layout: z.enum(LOGIN_LAYOUTS), image: imageSchema }),
  images: z.object({ homeBanner: imageSchema }),
  // partialRecord: a locale without overrides is simply absent
  texts: z.partialRecord(
    z.enum(APPEARANCE_LOCALES),
    z.record(z.string().refine(isTextKey), z.string().max(MAX_TEXT_OVERRIDE_LENGTH))
  ),
};

export const appearanceSchema = z.object(sections);
export type Appearance = z.infer<typeof appearanceSchema>;

export const DEFAULT_APPEARANCE: Appearance = {
  preset: 'default',
  colors: { light: {}, dark: {} },
  fonts: { sans: 'plex', heading: 'plex', mono: 'plex' },
  radius: 'default',
  login: { layout: 'centered', image: null },
  images: { homeBanner: null },
  texts: {},
};

/**
 * Read the stored setting. Each section falls back to its default on its own,
 * so one invalid section (older format, manual edit) does not reset the rest.
 */
export function parseAppearance(raw: unknown): Appearance {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return structuredClone(DEFAULT_APPEARANCE);
    }
  }
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out = structuredClone(DEFAULT_APPEARANCE) as Record<string, unknown>;
  for (const [name, schema] of Object.entries(sections)) {
    const parsed = schema.safeParse(input[name]);
    if (parsed.success) out[name] = parsed.data;
  }
  return out as Appearance;
}

/** Preset, then the admin's own colours on top */
export function resolvePalettes(a: Appearance): { light: Palette; dark: Palette } {
  const preset = THEME_PRESETS[a.preset] ?? THEME_PRESETS.default!;
  return {
    light: { ...DEFAULT_PALETTES.light, ...preset.light, ...a.colors.light },
    dark: { ...DEFAULT_PALETTES.dark, ...preset.dark, ...a.colors.dark },
  };
}

/** '#1d8556' -> '29 133 86', the channel format the Tailwind tokens expect */
export function hexToChannels(value: string): string {
  const n = parseInt(value.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const declarations = (palette: Palette) =>
  THEME_TOKENS.map((t) => `--${t}:${hexToChannels(palette[t])};`).join('');

/**
 * CSS overriding main.css. `html:root` outranks main.css's `:root` whatever
 * the order the stylesheets load in. Every value comes from a validated enum
 * or hex colour, so nothing admin-typed reaches the stylesheet as is.
 */
export function buildThemeCss(a: Appearance): string {
  const { light, dark } = resolvePalettes(a);
  const base =
    `--font-sans:${SANS_FONTS[a.fonts.sans]};` +
    `--font-heading:${SANS_FONTS[a.fonts.heading]};` +
    `--font-mono:${MONO_FONTS[a.fonts.mono]};` +
    `--radius:${RADII[a.radius]};`;
  return (
    `html:root{${base}${declarations(light)}}` +
    `@media (prefers-color-scheme: dark){html:root:not([data-theme='light']){${declarations(dark)}}}` +
    `html:root[data-theme='dark']{${declarations(dark)}}`
  );
}

/** The parts of vue-i18n's MessageContext an override message uses */
export interface OverrideMessageContext {
  named: (key: string) => unknown;
  plural: (messages: string[]) => string;
}
export type OverrideMessage = (ctx: OverrideMessageContext) => string;
export interface OverrideTree {
  [key: string]: OverrideTree | OverrideMessage;
}

/**
 * An admin text as a vue-i18n message function: {name} placeholders and
 * ' | ' plural forms work like in the locale files, and nothing else is
 * special (no @ links, no compiler). Output is text, escaped by Vue.
 */
export function overrideMessage(text: string): OverrideMessage {
  const forms = text.split(' | ');
  return (ctx) => {
    const fill = (form: string) =>
      form.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = ctx.named(name);
        return value === undefined || value === null ? match : String(value);
      });
    return forms.length > 1 ? ctx.plural(forms.map(fill)) : fill(text);
  };
}

/** Flat 'a.b.c' overrides as the nested message tree vue-i18n merges */
export function buildOverrideTree(texts: Record<string, string> | undefined): OverrideTree {
  const tree: OverrideTree = Object.create(null);
  for (const [key, text] of Object.entries(texts ?? {})) {
    if (!isTextKey(key)) continue;
    const parts = key.split('.');
    let node: OverrideTree | null = tree;
    for (const part of parts.slice(0, -1)) {
      const next: OverrideTree | OverrideMessage | undefined = node[part];
      // 'a.b' already holds a text: 'a.b.c' cannot exist next to it
      if (typeof next === 'function') {
        node = null;
        break;
      }
      node = next ?? (node[part] = Object.create(null) as OverrideTree);
    }
    if (node) node[parts[parts.length - 1]!] = overrideMessage(text);
  }
  return tree;
}

export interface MessageTree {
  [key: string]: MessageTree | string;
}

/** Locale file tree as flat 'a.b.c' keys (strings only) */
export function flattenMessages(tree: MessageTree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') flattenMessages(value, path, out);
  }
  return out;
}

/**
 * Overrides worth storing: keys the shipped translations define (own keys
 * only, not toString & co.), and no copy of the shipped text, which would
 * hide later translation fixes.
 */
export function keepTextOverrides(
  overrides: Record<string, string>,
  source: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).filter(
      ([key, text]) => Object.hasOwn(source, key) && text.trim() !== '' && text !== source[key]
    )
  );
}
