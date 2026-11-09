/**
 * BBCode to HTML for torrent descriptions. Every text node is escaped and only
 * whitelisted tags produce markup; links and images must be http(s). The
 * result still goes through DOMPurify before reaching v-html (app/utils/markdown.ts).
 *
 * Supported: b i u s, center left right, size=1-7, color, url, url=, img,
 * quote, quote=, code, spoiler, spoiler=, list, list=1, [*], hr.
 * Unknown or unbalanced tags stay as plain text.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

const PAIRED = new Set([
  'b', 'i', 'u', 's', 'center', 'left', 'right', 'size', 'color',
  'url', 'img', 'quote', 'code', 'spoiler', 'list',
]);
/** Tags whose surrounding line breaks are layout, not content */
const BLOCK = new Set(['center', 'left', 'right', 'quote', 'code', 'spoiler', 'list']);

const SIZES = ['0.75em', '0.875em', '1em', '1.125em', '1.375em', '1.75em', '2.25em'];

/** True when the text uses BBCode (a known tag opened and closed) */
export function looksLikeBbcode(text: string): boolean {
  return /\[(b|i|u|s|center|size|color|url|img|quote|code|spoiler|list)(=[^\]]*)?\][\s\S]*?\[\/\1\]/i.test(text);
}

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(url)) return null;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function safeColor(raw: string): string | null {
  const color = raw.trim();
  return /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]{3,20})$/i.test(color) ? color : null;
}

interface Node {
  tag: string;
  arg: string | null;
  children: (Node | string)[];
  /** Source text of the opening tag, to restore it when never closed */
  raw: string;
}

const TOKEN = /\[(\/?)([a-z]+|\*)(?:=([^\]\n]{0,500}))?\]/gi;

function parse(source: string): Node {
  const root: Node = { tag: '', arg: null, children: [], raw: '' };
  const stack: Node[] = [root];
  let last = 0;
  const top = () => stack[stack.length - 1]!;
  const text = (t: string) => t && top().children.push(t);

  for (const match of source.matchAll(TOKEN)) {
    const [raw, closing, rawName, arg] = match;
    const name = rawName!.toLowerCase();
    const index = match.index!;
    const current = top();

    // Inside [code], everything but its closing tag is text
    if (current.tag === 'code' && !(closing && name === 'code')) continue;

    text(source.slice(last, index));
    last = index + raw.length;

    if (name === '*') {
      if (closing) {
        text(raw);
        continue;
      }
      // A list item runs until the next [*] or the end of the list
      if (current.tag === '*') stack.pop();
      if (top().tag !== 'list') {
        text(raw);
        continue;
      }
      const item: Node = { tag: '*', arg: null, children: [], raw };
      top().children.push(item);
      stack.push(item);
      continue;
    }
    if (name === 'hr' && !closing) {
      top().children.push({ tag: 'hr', arg: null, children: [], raw });
      continue;
    }
    if (!PAIRED.has(name)) {
      text(raw);
      continue;
    }
    if (!closing) {
      const node: Node = { tag: name, arg: arg ?? null, children: [], raw };
      current.children.push(node);
      stack.push(node);
      continue;
    }
    // Closing tag: close up to the matching opener (list items close with their list)
    const at = stack.map((n) => n.tag).lastIndexOf(name);
    if (at <= 0) {
      text(raw);
      continue;
    }
    stack.length = at;
  }
  // [code] swallowed the rest as text
  if (top().tag === 'code') {
    top().children.push(source.slice(last));
  } else {
    text(source.slice(last));
  }
  // Never closed: back to text, children kept
  for (let i = stack.length - 1; i > 0; i--) {
    const node = stack[i]!;
    if (node.tag === '*') continue;
    node.tag = `unclosed:${node.raw}`;
  }
  return root;
}

function textOf(node: Node): string {
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}

/** Escape text; line breaks become <br>, except next to block tags */
function renderText(text: string, trimStart: boolean, trimEnd: boolean): string {
  let t = text;
  if (trimStart) t = t.replace(/^[ \t]*\r?\n/, '');
  if (trimEnd) t = t.replace(/\r?\n[ \t]*$/, '');
  return escapeHtml(t).replace(/\r?\n/g, '<br>');
}

function renderChildren(node: Node): string {
  const kids = node.children;
  return kids
    .map((child, i) => {
      if (typeof child !== 'string') return renderNode(child);
      const prev = kids[i - 1];
      const next = kids[i + 1];
      const isBlock = (n: Node | string | undefined) =>
        typeof n === 'object' && (BLOCK.has(n.tag) || n.tag === 'hr' || n.tag === '*');
      // Inside a list, text between items is layout
      if (node.tag === 'list') return child.trim() ? escapeHtml(child.trim()) : '';
      return renderText(
        child,
        i === 0 ? BLOCK.has(node.tag) || node.tag === '*' : isBlock(prev),
        i === kids.length - 1 ? BLOCK.has(node.tag) || node.tag === '*' : isBlock(next)
      );
    })
    .join('');
}

function renderNode(node: Node): string {
  if (node.tag.startsWith('unclosed:')) {
    return escapeHtml(node.tag.slice('unclosed:'.length)) + renderChildren(node);
  }
  const inner = () => renderChildren(node);
  switch (node.tag) {
    case 'b':
      return `<strong>${inner()}</strong>`;
    case 'i':
      return `<em>${inner()}</em>`;
    case 'u':
      return `<u>${inner()}</u>`;
    case 's':
      return `<s>${inner()}</s>`;
    case 'center':
    case 'left':
    case 'right':
      return `<div style="text-align:${node.tag}">${inner()}</div>`;
    case 'size': {
      const size = SIZES[Number(node.arg) - 1];
      return size ? `<span style="font-size:${size}">${inner()}</span>` : inner();
    }
    case 'color': {
      const color = node.arg ? safeColor(node.arg) : null;
      return color ? `<span style="color:${color}">${inner()}</span>` : inner();
    }
    case 'url': {
      const href = safeUrl(node.arg ?? textOf(node));
      if (!href) return inner();
      return `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer">${inner()}</a>`;
    }
    case 'img': {
      const src = safeUrl(textOf(node));
      return src ? `<img src="${escapeHtml(src)}" alt="" loading="lazy">` : escapeHtml(textOf(node));
    }
    case 'quote':
      return `<blockquote>${node.arg ? `<cite>${escapeHtml(node.arg)}</cite>` : ''}${inner()}</blockquote>`;
    case 'code':
      return `<pre><code>${escapeHtml(textOf(node).replace(/^\r?\n|\r?\n$/g, ''))}</code></pre>`;
    case 'spoiler':
      return `<details><summary>${escapeHtml(node.arg?.trim() || 'Spoiler')}</summary>${inner()}</details>`;
    case 'list':
      return node.arg === '1' ? `<ol>${inner()}</ol>` : `<ul>${inner()}</ul>`;
    case '*':
      return `<li>${inner()}</li>`;
    case 'hr':
      return '<hr>';
    default:
      return inner();
  }
}

export function bbcodeToHtml(source: string): string {
  return renderChildren(parse(source));
}
