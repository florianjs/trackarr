/**
 * Read a Torznab response well enough to tell a user whether their setup
 * works: an <error code description/> document, or an RSS feed of items.
 */
export type TorznabCheck =
  | { ok: true; items: number }
  | { ok: false; code: number | null; description: string };

const decode = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export function checkTorznabResponse(xml: string): TorznabCheck {
  const error = /<error\b([^>]*)\/?>/i.exec(xml);
  if (error) {
    const code = /\bcode="(\d+)"/.exec(error[1]!);
    const description = /\bdescription="([^"]*)"/.exec(error[1]!);
    return {
      ok: false,
      code: code ? Number(code[1]) : null,
      description: description ? decode(description[1]!) : 'Unknown error',
    };
  }

  if (!/<rss\b/i.test(xml)) {
    return { ok: false, code: null, description: 'Not a Torznab response' };
  }

  return { ok: true, items: (xml.match(/<item\b/gi) ?? []).length };
}
