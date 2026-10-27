import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { HouseholdService } from './household';
import { InventoryStore } from './inventory-store';

describe('InventoryStore', () => {
  let store: InventoryStore;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    await TestBed.inject(AuthService).signUp('Sam', 'sam@example.com', 'password1');
    TestBed.inject(HouseholdService).create();
    store = TestBed.inject(InventoryStore);
  });

  const milk = {
    name: ' Leche ',
    category: 'pantry' as const,
    unit: 'cartones',
    monthlyUsage: 12,
    currentQty: 2,
  };

  it('adds a trimmed item and lists it as to-buy', () => {
    store.add(milk);
    expect(store.items()[0].name).toBe('Leche');
    expect(store.toBuy().length).toBe(1);
    expect(store.unitsShort()).toBe(10);
  });

  it('steps quantities without going below zero', () => {
    const item = store.add({ ...milk, currentQty: 0 })!;
    store.adjust(item.id, -1);
    expect(store.byId(item.id)?.currentQty).toBe(0);
    store.adjust(item.id, 3);
    expect(store.byId(item.id)?.currentQty).toBe(3);
  });

  it('restocks to the monthly level and reports the previous quantity', () => {
    const item = store.add(milk)!;
    expect(store.restock(item.id)).toBe(2);
    expect(store.byId(item.id)?.currentQty).toBe(12);
    expect(store.toBuy().length).toBe(0);
  });

  it('removes an item and can put it back in place', () => {
    const a = store.add({ ...milk, name: 'A' })!;
    store.add({ ...milk, name: 'B' });
    const undo = store.remove(a.id)!;
    expect(store.items().map((i) => i.name)).toEqual(['B']);
    undo();
    expect(store.items().map((i) => i.name)).toEqual(['A', 'B']);
  });

  it('persists items per household', () => {
    store.add(milk);
    TestBed.tick();
    const householdId = TestBed.inject(HouseholdService).current()!.id;
    expect(store.countFor(householdId)).toBe(1);
  });
});
