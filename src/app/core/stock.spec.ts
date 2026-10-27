import {
  clampQty,
  generateInviteCode,
  groupByCategory,
  needToBuy,
  normalizeInviteCode,
  toBuyList,
} from './stock';

describe('needToBuy', () => {
  it('returns what is missing to reach the monthly level', () => {
    expect(needToBuy({ monthlyUsage: 12, currentQty: 2 })).toBe(10);
  });

  it('never goes negative when there is surplus', () => {
    expect(needToBuy({ monthlyUsage: 2, currentQty: 5 })).toBe(0);
  });
});

describe('toBuyList', () => {
  it('keeps only short items, biggest shortfall first', () => {
    const list = toBuyList([
      { id: 'a', monthlyUsage: 2, currentQty: 1 },
      { id: 'b', monthlyUsage: 4, currentQty: 4 },
      { id: 'c', monthlyUsage: 24, currentQty: 9 },
    ]);
    expect(list.map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('groupByCategory', () => {
  it('follows the category order and drops empty groups', () => {
    const groups = groupByCategory([
      { id: 1, category: 'cleaning' as const },
      { id: 2, category: 'pantry' as const },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['pantry', 'cleaning']);
  });
});

describe('clampQty', () => {
  it('rounds and clamps into range', () => {
    expect(clampQty(-3)).toBe(0);
    expect(clampQty(2.6)).toBe(3);
    expect(clampQty(Number.NaN)).toBe(0);
    expect(clampQty(5000)).toBe(999);
  });
});

describe('invite codes', () => {
  it('generates six unambiguous characters', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('normalizes user input', () => {
    expect(normalizeInviteCode(' 4kq-2zp9 ')).toBe('4KQ2ZP');
  });
});
