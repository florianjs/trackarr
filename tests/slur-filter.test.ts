import { describe, expect, it } from 'vitest';
import { censorSlurs, isSlur, normalizeWord, parseExtraWords } from '../shared/utils/slurFilter';

describe('normalizeWord', () => {
  it('lowercases, strips accents and decodes leetspeak', () => {
    expect(normalizeWord('NÈGRE')).toBe('negre');
    expect(normalizeWord('N1GG3R')).toBe('nigger');
    expect(normalizeWord('f@g')).toBe('fag');
  });
});

describe('isSlur', () => {
  it.each(['nigger', 'Niggas', 'NIIIGGER', 'n1gg@', 'faggot', 'kikes', 'nègre', 'Bougnoules', 'pédé', 'tarlouze', 'Neger', 'maricón'])(
    'catches %s',
    (word) => expect(isSlur(word)).toBe(true)
  );

  it.each(['Niger', 'Nigeria', 'snigger', 'Scunthorpe', 'retard', 'negro', 'pedestrian', 'spice', 'chinking', 'kiker', 'hello'])(
    'leaves %s alone',
    (word) => expect(isSlur(word)).toBe(false)
  );
});

describe('censorSlurs', () => {
  it('masks slurs with as many asterisks, keeps the rest', () => {
    const { text, changed } = censorSlurs('Hey nigger, ça va ? Je suis en retard.');
    expect(text).toBe('Hey ******, ça va ? Je suis en retard.');
    expect(changed).toBe(true);
  });

  it('keeps punctuation around and inside html', () => {
    expect(censorSlurs('<p>sale nègre!</p>').text).toBe('<p>sale *****!</p>');
  });

  it('reports no change on clean text', () => {
    expect(censorSlurs('Welcome to Niger')).toEqual({ text: 'Welcome to Niger', changed: false });
  });
});

describe('parseExtraWords', () => {
  it('matches exact words and plurals, or prefixes with *', () => {
    const extra = parseExtraWords('badword\nslur*\n x ');
    expect(extra).toHaveLength(2);
    expect(isSlur('badwords', extra)).toBe(true);
    expect(isSlur('badwordy', extra)).toBe(false);
    expect(isSlur('slurring', extra)).toBe(true);
    expect(censorSlurs('a BADWORD here', extra).text).toBe('a ******* here');
  });

  it('ignores empty input', () => {
    expect(parseExtraWords(null)).toEqual([]);
    expect(parseExtraWords('')).toEqual([]);
  });
});
