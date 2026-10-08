import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize admin-authored rich text (WYSIWYG branding/homepage fields).
 * These values are rendered with v-html for every visitor, so only
 * formatting markup survives: no scripts, event handlers or javascript: URLs.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small',
    'sub', 'sup', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
  ],
  allowedAttributes: {
    '*': ['class', 'style'],
    a: ['href', 'target', 'rel'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function sanitizeRichText<T extends string | null | undefined>(
  value: T
): T {
  if (value == null) return value;
  return sanitizeHtml(value, RICH_TEXT_OPTIONS) as T;
}
