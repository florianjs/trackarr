import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_PALETTES,
  THEME_PRESETS,
  THEME_TOKENS,
  appearanceSchema,
  buildOverrideTree,
  buildThemeCss,
  hexToChannels,
  overrideMessage,
  parseAppearance,
  resolvePalettes,
  type OverrideMessage,
  type OverrideMessageContext,
} from '../shared/utils/appearance';

const ctx = (named: Record<string, unknown> = {}, index = 0): OverrideMessageContext => ({
  named: (key) => named[key],
  plural: (messages) => messages[Math.min(index, messages.length - 1)]!,
});

describe('parseAppearance', () => {
  it('returns defaults for missing or broken values', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('{not json')).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('[]')).toEqual(DEFAULT_APPEARANCE);
  });

  it('keeps valid sections when another one is invalid', () => {
    const a = parseAppearance(JSON.stringify({ preset: 'midnight', radius: 'huge', fonts: { sans: 'inter', heading: 'serif', mono: 'jetbrains' } }));
    expect(a.preset).toBe('midnight');
    expect(a.radius).toBe('default');
    expect(a.fonts).toEqual({ sans: 'inter', heading: 'serif', mono: 'jetbrains' });
  });

  it('does not return a shared default object', () => {
    parseAppearance(null).colors.light.bg = '#000000';
    expect(DEFAULT_APPEARANCE.colors.light.bg).toBeUndefined();
  });
});

describe('appearanceSchema', () => {
  it('accepts the defaults', () => {
    expect(appearanceSchema.safeParse(DEFAULT_APPEARANCE).success).toBe(true);
  });

  it('rejects colours that could escape the stylesheet', () => {
    const colors = { light: { bg: 'red;}body{display:none' }, dark: {} };
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, colors }).success).toBe(false);
  });

  it('rejects unknown tokens', () => {
    const colors = { light: { evil: '#000000' }, dark: {} };
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, colors }).success).toBe(false);
  });

  it('only accepts images uploaded for the appearance', () => {
    const ok = { ...DEFAULT_APPEARANCE, login: { layout: 'split', image: '/uploads/appearance-0123456789abcdef.webp' } };
    expect(appearanceSchema.safeParse(ok).success).toBe(true);
    for (const image of ['https://evil.test/a.png', '/uploads/../x.png', '/uploads/appearance-0123456789abcdef.svg']) {
      const bad = { ...DEFAULT_APPEARANCE, login: { layout: 'split', image } };
      expect(appearanceSchema.safeParse(bad).success, image).toBe(false);
    }
  });

  it('validates text override locales and keys', () => {
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, texts: { fr: { 'auth.login.signIn': 'Entrer' } } }).success).toBe(true);
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, texts: { xx: { a: 'b' } } }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, texts: { en: { '../a': 'b' } } }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, texts: { en: JSON.parse('{"__proto__.x":"b"}') } }).success).toBe(false);
  });
});

describe('palettes', () => {
  it('every preset only overrides known tokens with hex colours', () => {
    for (const [name, preset] of Object.entries(THEME_PRESETS)) {
      for (const palette of [preset.light, preset.dark]) {
        for (const [token, value] of Object.entries(palette)) {
          expect(THEME_TOKENS, `${name}.${token}`).toContain(token);
          expect(value, `${name}.${token}`).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it('applies preset then admin colours', () => {
    const a = { ...DEFAULT_APPEARANCE, preset: 'midnight', colors: { light: { free: '#123456' }, dark: {} } };
    const { light, dark } = resolvePalettes(a);
    expect(light.free).toBe('#123456');
    expect(light.bg).toBe(THEME_PRESETS.midnight!.light.bg);
    expect(light.seed).toBe(DEFAULT_PALETTES.light.seed);
    expect(dark.free).toBe(THEME_PRESETS.midnight!.dark.free);
  });

  it('converts hex to channels', () => {
    expect(hexToChannels('#1d8556')).toBe('29 133 86');
    expect(hexToChannels('#ffffff')).toBe('255 255 255');
  });
});

describe('buildThemeCss', () => {
  it('reproduces main.css for the defaults', () => {
    const css = buildThemeCss(DEFAULT_APPEARANCE);
    expect(css).toContain('--bg:243 244 246;');
    expect(css).toContain("html:root[data-theme='dark']{--bg:23 24 27;");
    expect(css).toContain('--font-sans:"IBM Plex Sans"');
    expect(css).toContain('--radius:0.3125rem;');
  });

  it('uses the chosen fonts', () => {
    const css = buildThemeCss({ ...DEFAULT_APPEARANCE, fonts: { sans: 'inter', heading: 'serif', mono: 'jetbrains' } });
    expect(css).toContain('--font-sans:"Inter"');
    expect(css).toContain('--font-heading:"Source Serif 4"');
    expect(css).toContain('--font-mono:"JetBrains Mono"');
  });
});

describe('overrideMessage', () => {
  it('fills named placeholders', () => {
    expect(overrideMessage('Hello {name}!')(ctx({ name: 'Ada' }))).toBe('Hello Ada!');
  });

  it('keeps unknown placeholders and special characters as typed', () => {
    expect(overrideMessage('{missing} @mail | not plural?')(ctx())).toBe('{missing} @mail');
    expect(overrideMessage('a@b.c {x}')(ctx())).toBe('a@b.c {x}');
  });

  it('picks the plural form', () => {
    const message = overrideMessage('none | one item | {n} items');
    expect(message(ctx({ n: 5 }, 2))).toBe('5 items');
    expect(message(ctx({ n: 1 }, 1))).toBe('one item');
  });
});

describe('buildOverrideTree', () => {
  it('nests dotted keys', () => {
    const tree = buildOverrideTree({ 'auth.login.signIn': 'Go', 'auth.title': 'T' });
    const auth = tree.auth as Record<string, unknown>;
    expect(typeof auth.title).toBe('function');
    expect(((auth.login as Record<string, OverrideMessage>).signIn)(ctx())).toBe('Go');
  });

  it('skips keys under an existing text and invalid keys', () => {
    const tree = buildOverrideTree({ 'a.b': 'x', 'a.b.c': 'y', '__proto__.x': 'z', 'bad key': 'w' });
    expect(typeof (tree.a as Record<string, unknown>).b).toBe('function');
    expect(Object.keys(tree)).toEqual(['a']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(Object.keys(buildOverrideTree({ 'constructor.prototype.y': 'z' }))).toEqual([]);
  });
});
