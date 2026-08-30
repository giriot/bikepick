import { describe, it, expect } from 'vitest';
import { phoneSchema, emailSchema, pincodeSchema, gstinSchema, leadSchema, reviewSchema } from '@/lib/validation';

describe('Input validation', () => {
  it('accepts valid Indian mobile numbers and strips formatting', () => {
    expect(phoneSchema.parse('98765 43210')).toBe('9876543210');
    expect(phoneSchema.parse('+91 98765 43210')).toBe('9876543210');
  });

  it('rejects impossible mobile numbers', () => {
    expect(() => phoneSchema.parse('12345')).toThrow();
    expect(() => phoneSchema.parse('1234567890')).toThrow();
  });

  it('normalises email case', () => {
    expect(emailSchema.parse('  Rider@Example.COM ')).toBe('rider@example.com');
  });

  it('validates pincodes and GSTINs', () => {
    expect(pincodeSchema.parse('641001')).toBe('641001');
    expect(() => pincodeSchema.parse('041001')).toThrow();
    expect(() => gstinSchema.parse('NOTAGSTIN')).toThrow();
  });

  it('requires a name and phone on every lead', () => {
    expect(() => leadSchema.parse({ lead_type: 'best_price' })).toThrow();
    const ok = leadSchema.parse({ lead_type: 'best_price', name: 'Arun', phone: '9876543210' });
    expect(ok.name).toBe('Arun');
  });

  it('rejects an unknown lead type', () => {
    expect(() => leadSchema.parse({ lead_type: 'spam_blast', name: 'A', phone: '9876543210' })).toThrow();
  });

  it('bounds review ratings to 1-5', () => {
    expect(() => reviewSchema.parse({ product_id: 'p1', rating: 9, title: 'Great bike here', body: 'x'.repeat(60) })).toThrow();
  });
});
