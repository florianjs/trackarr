import { describe, it, expect } from 'vitest';
import { DEFAULT_FOOTER_LINKS, MAX_FOOTER_LINKS, parseFooterLinks } from '../shared/utils/footerLinks';

describe('parseFooterLinks', () => {
  it('accepts the defaults', () => {
    expect(parseFooterLinks(DEFAULT_FOOTER_LINKS)).toEqual(DEFAULT_FOOTER_LINKS);
  });

  it('accepts an empty list (no links)', () => {
    expect(parseFooterLinks([])).toEqual([]);
  });

  it('trims labels and urls, allows mailto', () => {
    expect(parseFooterLinks([{ icon: 'ph:envelope', label: ' Contact ', url: ' mailto:admin@example.com ' }])).toEqual([
      { icon: 'ph:envelope', label: 'Contact', url: 'mailto:admin@example.com' },
    ]);
  });

  it('rejects dangerous urls and unknown icons', () => {
    expect(parseFooterLinks([{ icon: 'ph:globe', label: 'x', url: 'javascript:alert(1)' }])).toBeNull();
    expect(parseFooterLinks([{ icon: 'ph:globe', label: 'x', url: 'data:text/html,hi' }])).toBeNull();
    expect(parseFooterLinks([{ icon: 'mdi:evil', label: 'x', url: 'https://a.b' }])).toBeNull();
    expect(parseFooterLinks([{ icon: 'ph:globe', label: '', url: 'https://a.b' }])).toBeNull();
  });

  it('rejects non-arrays and too many links', () => {
    expect(parseFooterLinks('nope')).toBeNull();
    const many = Array.from({ length: MAX_FOOTER_LINKS + 1 }, () => DEFAULT_FOOTER_LINKS[0]);
    expect(parseFooterLinks(many)).toBeNull();
  });
});
