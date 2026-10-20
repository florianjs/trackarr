import { describe, it, expect } from 'vitest';
import { checkTorznabResponse } from '../shared/utils/torznabResponse';

describe('checkTorznabResponse', () => {
  it('reads a Torznab error', () => {
    const xml = '<?xml version="1.0"?>\n<error code="100" description="Incorrect user credentials"/>';
    expect(checkTorznabResponse(xml)).toEqual({
      ok: false,
      code: 100,
      description: 'Incorrect user credentials',
    });
  });

  it('decodes entities in the description', () => {
    const xml = '<error code="900" description="Torznab &amp; &quot;API&quot; disabled" />';
    expect(checkTorznabResponse(xml)).toMatchObject({ description: 'Torznab & "API" disabled' });
  });

  it('counts items of a search feed', () => {
    const xml = '<rss version="2.0"><channel><item><title>a</title></item><item><title>b</title></item></channel></rss>';
    expect(checkTorznabResponse(xml)).toEqual({ ok: true, items: 2 });
  });

  it('accepts an empty feed', () => {
    expect(checkTorznabResponse('<rss version="2.0"><channel></channel></rss>')).toEqual({ ok: true, items: 0 });
  });

  it('rejects anything else, like a login page', () => {
    expect(checkTorznabResponse('<!doctype html><html></html>')).toMatchObject({ ok: false, code: null });
  });
});
