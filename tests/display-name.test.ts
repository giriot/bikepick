import { describe, it, expect } from 'vitest';
import { displayName, modelDisplayName } from '@/lib/format';

describe('displayName — no double brand', () => {
  it('joins brand + clean model', () => {
    expect(displayName('Hero', 'Xtreme 125R')).toBe('Hero Xtreme 125R');
    expect(displayName('TVS', 'Raider 125')).toBe('TVS Raider 125');
  });

  it('strips a brand that is already baked into the model name', () => {
    expect(displayName('TVS', 'TVS Raider 125')).toBe('TVS Raider 125');
    expect(displayName('Honda', 'Honda Activa E')).toBe('Honda Activa E');
    expect(displayName('Royal Enfield', 'Royal Enfield Hunter 350')).toBe('Royal Enfield Hunter 350');
    expect(displayName('Yamaha', 'Yamaha FZ-SFI V4')).toBe('Yamaha FZ-SFI V4');
    expect(displayName('Ola', 'Ola S1 Pro')).toBe('Ola S1 Pro');
  });

  it('is case-insensitive on the brand prefix', () => {
    expect(displayName('Honda', 'honda Shine 100')).toBe('Honda Shine 100');
  });

  it('handles missing pieces', () => {
    expect(displayName('', 'Xtreme 125R')).toBe('Xtreme 125R');
    expect(displayName('Hero', '')).toBe('Hero');
    expect(displayName(null, null)).toBe('');
  });
});

describe('modelDisplayName — H1 / card title under a brand label', () => {
  it('returns the model as-is when brand is not repeated', () => {
    expect(modelDisplayName('Hero', 'Xtreme 125R')).toBe('Xtreme 125R');
  });

  it('strips a leading brand so H1 is not "TVS TVS Raider 125"', () => {
    expect(modelDisplayName('TVS', 'TVS Raider 125')).toBe('Raider 125');
    expect(modelDisplayName('Royal Enfield', 'Royal Enfield Hunter 350')).toBe('Hunter 350');
    expect(modelDisplayName('Honda', 'Honda SP 125')).toBe('SP 125');
  });

  it('keeps the full string when stripping would leave nothing', () => {
    expect(modelDisplayName('Hero', 'Hero')).toBe('Hero');
  });
});
