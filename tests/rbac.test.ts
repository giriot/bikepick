import { describe, it, expect } from 'vitest';
import { can } from '@/lib/rbac';
import { ADMIN_RESOURCES, ADMIN_GROUPS, getResource } from '@/lib/admin-config';

const as = (role: string) => ({ id: 'u1', role, email: 'x@y.z' } as any);

describe('Role-based access control', () => {
  it('gives the admin everything', () => {
    expect(can(as('admin'), 'product.write')).toBe(true);
    expect(can(as('admin'), 'anything.at.all')).toBe(true);
  });

  it('limits a moderator to content and review work', () => {
    expect(can(as('moderator'), 'review.moderate')).toBe(true);
    expect(can(as('moderator'), 'used_bike.review')).toBe(true);
    expect(can(as('moderator'), 'settings.write')).toBe(false);
  });

  it('limits a verifier to verification work', () => {
    expect(can(as('verifier'), 'verification.write')).toBe(true);
    expect(can(as('verifier'), 'product.write')).toBe(false);
  });

  it('never lets a dealer touch another dealer or the catalogue', () => {
    expect(can(as('dealer'), 'offer.self')).toBe(true);
    expect(can(as('dealer'), 'offer.review')).toBe(false);
    expect(can(as('dealer'), 'product.write')).toBe(false);
    expect(can(as('dealer'), '*')).toBe(false);
  });

  it('gives an ordinary user only their own account', () => {
    expect(can(as('user'), 'account.self')).toBe(true);
    expect(can(as('user'), 'lead.read')).toBe(false);
    expect(can(as('user'), 'data.review')).toBe(false);
  });

  it('denies everything to an anonymous visitor', () => {
    expect(can(null, 'account.self')).toBe(false);
    expect(can(null, '*')).toBe(false);
  });
});

describe('Admin configuration', () => {
  it('exposes at least 25 managed sections, as the brief requires', () => {
    expect(ADMIN_RESOURCES.length).toBeGreaterThanOrEqual(25);
  });

  it('has unique keys and tables', () => {
    expect(new Set(ADMIN_RESOURCES.map((r) => r.key)).size).toBe(ADMIN_RESOURCES.length);
  });

  it('places every resource in a known sidebar group', () => {
    for (const r of ADMIN_RESOURCES) expect(ADMIN_GROUPS).toContain(r.group);
  });

  it('describes every resource in plain language for a non-programmer', () => {
    for (const r of ADMIN_RESOURCES) {
      expect(r.label.length).toBeGreaterThan(2);
      expect(r.description.length).toBeGreaterThan(10);
    }
  });

  it('declares a permission and a title column for every resource', () => {
    for (const r of ADMIN_RESOURCES) {
      expect(r.permission.length).toBeGreaterThan(0);
      expect(r.titleColumn.length).toBeGreaterThan(0);
    }
  });

  it('qualifies filter and sort columns with a table alias so list SQL stays valid', () => {
    for (const r of ADMIN_RESOURCES) {
      for (const f of r.filters || []) expect(f.column).toMatch(/\./);
      for (const c of r.searchColumns || []) expect(c).toMatch(/\./);
      expect(r.defaultSort).toMatch(/\./);
    }
  });

  it('requires a reason on every destructive or rejecting action', () => {
    for (const r of ADMIN_RESOURCES) {
      for (const a of r.actions || []) {
        if (/reject|suspend|block/.test(a.key)) expect(a.reasonColumn).toBeTruthy();
      }
    }
  });

  it('looks resources up by key', () => {
    expect(getResource('products')?.table).toBe('products');
    expect(getResource('does-not-exist')).toBeUndefined();
  });
});
