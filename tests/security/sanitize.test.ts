import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '../../server/utils/sanitize';
import { cdata, escapeLike } from '../../server/utils/validation';

describe('sanitizeRichText', () => {
  it('strips scripts and event handlers', () => {
    const out = sanitizeRichText(
      '<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p>'
    );
    expect(out).toBe('<p>Hi</p>');
  });

  it('keeps editor formatting', () => {
    const html =
      '<p><strong>Bold</strong> <em>it</em> <span style="color:#ff0000">red</span></p>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('drops javascript: links and unsafe styles', () => {
    const out = sanitizeRichText(
      '<a href="javascript:alert(1)">x</a><span style="background:url(javascript:1)">y</span>'
    );
    expect(out).not.toContain('javascript');
  });

  it('passes null through', () => {
    expect(sanitizeRichText(null)).toBeNull();
  });
});

describe('cdata', () => {
  it('cannot be closed by user content', () => {
    const out = cdata(']]><item><title>Fake</title></item><![CDATA[');
    expect(out.startsWith('<![CDATA[')).toBe(true);
    expect(out.endsWith(']]>')).toBe(true);
    // The only "]]>" sequences are our own split points and the final close
    const inner = out.slice('<![CDATA['.length, -']]>'.length);
    expect(inner.replace(/]]]]><!\[CDATA\[>/g, '')).not.toContain(']]>');
  });
});

describe('escapeLike', () => {
  it('escapes wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});
