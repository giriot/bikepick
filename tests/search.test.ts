import { describe, it, expect } from 'vitest';
import { slugify, normalizeKey, searchTokens, editDistance, fuzzyMatches } from '@/lib/slug';

describe('Slugs and normalisation', () => {
  it('slugifies Indian model names safely', () => {
    expect(slugify('Yamaha MT-15 V2')).toBe('yamaha-mt-15-v2');
    expect(slugify('Royal Enfield  Classic 350!')).toBe('royal-enfield-classic-350');
    expect(slugify('TVS iQube ST')).toBe('tvs-iqube-st');
  });

  it('collapses spelling variations to one key — the MT15 problem', () => {
    const keys = ['MT15', 'MT 15', 'MT-15', 'mt  15'].map((v) => normalizeKey('Yamaha', v));
    expect(new Set(keys).size).toBe(1);
  });

  it('treats brand + model as the identity of a model', () => {
    expect(normalizeKey('Honda', 'Activa 6G')).toBe(normalizeKey('honda', 'activa  6g'));
    expect(normalizeKey('Honda', 'Activa 6G')).not.toBe(normalizeKey('Hero', 'Activa 6G'));
  });

  it('tokenises a query into useful search terms', () => {
    const t = searchTokens('best 150cc bike under 2 lakh');
    expect(t).toContain('150cc'); // the literal token
    expect(t).toContain('150');   // and its split form, so "150 cc" also matches
    expect(t).toContain('cc');
  });

  it('measures edit distance for typo tolerance', () => {
    expect(editDistance('pulsar', 'pulsar')).toBe(0);
    expect(editDistance('pulsar', 'pulsr')).toBe(1);
    expect(editDistance('activa', 'aktiva')).toBeLessThanOrEqual(2);
  });

  it('fuzzy-matches common misspellings but rejects unrelated words', () => {
    expect(fuzzyMatches('activa', 'Activa 6G')).toBe(true);
    expect(fuzzyMatches('aktiva', 'Activa 6G')).toBe(true);
    expect(fuzzyMatches('bulldozer', 'Activa 6G')).toBe(false);
  });
});
