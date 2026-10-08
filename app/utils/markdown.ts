import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render user-supplied markdown to sanitized HTML.
 * marked passes raw HTML through, so the output must go through DOMPurify
 * before reaching v-html. DOMPurify needs a DOM: on the server this returns
 * an empty string, render the result inside <ClientOnly>.
 */
export function renderMarkdown(source: string | null | undefined): string {
  if (!source || import.meta.server) return '';
  const html = marked.parse(source, { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
