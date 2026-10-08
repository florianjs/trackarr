import { describe, it, expect } from 'vitest';
import {
  parseImdbId,
  parseMediaIds,
  parseTmdbId,
  parseTvdbId,
} from '../shared/utils/mediaIds';

describe('parseImdbId', () => {
  it.each([
    ['tt0133093', 'tt0133093'],
    ['0133093', 'tt0133093'],
    ['TT0133093', 'tt0133093'],
    ['https://www.imdb.com/title/tt0133093/', 'tt0133093'],
    ['https://m.imdb.com/title/tt12345678/?ref_=x', 'tt12345678'],
    ['  tt0133093  ', 'tt0133093'],
  ])('%s -> %s', (input, expected) => {
    expect(parseImdbId(input)).toBe(expected);
  });

  it.each(['', null, 'tt12', 'abc', 'https://evil.com/title/tt0133093', 'tt0133093<script>'])(
    'rejects %s',
    (input) => {
      expect(parseImdbId(input)).toBeNull();
    }
  );
});

describe('parseTmdbId', () => {
  it('parses ids and urls', () => {
    expect(parseTmdbId('603')).toBe(603);
    expect(parseTmdbId(603)).toBe(603);
    expect(parseTmdbId('https://www.themoviedb.org/movie/603-the-matrix')).toBe(603);
    expect(parseTmdbId('https://www.themoviedb.org/tv/1399')).toBe(1399);
  });

  it('rejects invalid values', () => {
    expect(parseTmdbId('0')).toBeNull();
    expect(parseTmdbId('-1')).toBeNull();
    expect(parseTmdbId('99999999999')).toBeNull();
    expect(parseTmdbId('https://example.com/movie/603')).toBeNull();
    expect(parseTmdbId('')).toBeNull();
  });
});

describe('parseTvdbId', () => {
  it('parses ids and legacy urls', () => {
    expect(parseTvdbId('81189')).toBe(81189);
    expect(parseTvdbId('https://thetvdb.com/?tab=series&id=81189')).toBe(81189);
  });

  it('rejects invalid values', () => {
    expect(parseTvdbId('https://thetvdb.com/series/breaking-bad')).toBeNull();
    expect(parseTvdbId('1.5')).toBeNull();
  });
});

describe('parseMediaIds', () => {
  it('only returns provided keys, clears empty ones', () => {
    expect(parseMediaIds({ imdbId: 'tt0133093', tmdbId: '' })).toEqual({
      ids: { imdbId: 'tt0133093', tmdbId: null },
      invalid: [],
    });
  });

  it('reports invalid values', () => {
    expect(parseMediaIds({ tvdbId: 'nope', imdbId: 'x' }).invalid).toEqual([
      'imdbId',
      'tvdbId',
    ]);
  });
});
