import { Item } from './models';
import { applyCategoryOps, applyOps, ItemOp } from './outbox';

const milk: Item = {
  id: 'milk',
  householdId: 'home',
  categoryId: 'pantry',
  name: 'Leche',
  unit: 'cartones',
  monthlyUsage: 12,
  currentQty: 2,
  updatedBy: 'ana',
  updatedAt: '2026-11-01T10:00:00Z',
  createdAt: '2026-11-01T10:00:00Z',
  pending: false,
};

const at = '2026-11-10T12:00:00Z';
const apply = (ops: ItemOp[], server: Item[] = [milk]) => applyOps(server, ops, 'home', 'beto');

describe('applyOps', () => {
  it('shows the server state untouched when nothing is pending', () => {
    expect(apply([])).toEqual([milk]);
  });

  it('adds up quantity changes and keeps them within 0..999', () => {
    const [item] = apply([
      { kind: 'adjust', opId: '1', at, itemId: 'milk', delta: -1 },
      { kind: 'adjust', opId: '2', at, itemId: 'milk', delta: -5 },
    ]);
    expect(item.currentQty).toBe(0);
    expect(
      apply([{ kind: 'adjust', opId: '1', at, itemId: 'milk', delta: 5000 }])[0].currentQty,
    ).toBe(999);
  });

  it('marks touched items as pending and attributes them to this person', () => {
    const [item] = apply([{ kind: 'restock', opId: '1', at, itemId: 'milk' }]);
    expect(item).toMatchObject({ currentQty: 12, pending: true, updatedBy: 'beto', updatedAt: at });
  });

  it('never lowers the quantity when restocking', () => {
    const [item] = apply(
      [{ kind: 'restock', opId: '1', at, itemId: 'milk' }],
      [{ ...milk, currentQty: 20 }],
    );
    expect(item.currentQty).toBe(20);
  });

  it('creates, edits and deletes in order', () => {
    const created = {
      id: 'soap',
      categoryId: 'bathroom',
      name: 'Jabón',
      unit: 'u',
      monthlyUsage: 2,
      currentQty: 0,
    };
    const items = apply([
      { kind: 'create', opId: '1', at, item: created },
      {
        kind: 'update',
        opId: '2',
        at,
        itemId: 'soap',
        changes: { ...created, name: 'Jabón de manos' },
      },
      { kind: 'delete', opId: '3', at, itemId: 'milk' },
    ]);
    expect(items.map((it) => it.name)).toEqual(['Jabón de manos']);
    expect(items[0]).toMatchObject({ householdId: 'home', pending: true, createdAt: at });
  });

  it('does not duplicate an item whose creation already reached the server', () => {
    const create: ItemOp = {
      kind: 'create',
      opId: '1',
      at,
      item: {
        id: 'milk',
        categoryId: 'pantry',
        name: 'Leche',
        unit: 'u',
        monthlyUsage: 1,
        currentQty: 0,
      },
    };
    expect(apply([create]).length).toBe(1);
  });

  it('ignores changes to an item someone else already deleted', () => {
    expect(apply([{ kind: 'adjust', opId: '1', at, itemId: 'gone', delta: 1 }])).toEqual([milk]);
  });
});

describe('applyCategoryOps', () => {
  const base = [
    { id: 'pantry', name: 'Despensa', isBase: true },
    { id: 'pets', name: 'Mascotas', isBase: false },
  ];

  it('creates, renames and deletes the household’s own categories in order', () => {
    const categories = applyCategoryOps(base, [
      { kind: 'createCategory', opId: '1', at, categoryId: 'garden', name: 'Jardín' },
      { kind: 'renameCategory', opId: '2', at, categoryId: 'pets', name: 'Mascota' },
      { kind: 'deleteCategory', opId: '3', at, categoryId: 'garden' },
    ]);
    expect(categories.map((c) => c.name)).toEqual(['Despensa', 'Mascota']);
  });

  it('never changes a base category', () => {
    const categories = applyCategoryOps(base, [
      { kind: 'renameCategory', opId: '1', at, categoryId: 'pantry', name: 'Comida' },
      { kind: 'deleteCategory', opId: '2', at, categoryId: 'pantry' },
    ]);
    expect(categories[0]).toEqual(base[0]);
  });

  it('leaves the items alone', () => {
    const op: ItemOp = { kind: 'createCategory', opId: '1', at, categoryId: 'x', name: 'X' };
    expect(apply([op])).toEqual([milk]);
  });
});
