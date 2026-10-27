import { ItemDraft } from './models';

/** Sample stock so the list can be tried out without typing 13 items. */
export const DEMO_ITEMS: { draft: ItemDraft; minutesAgo: number }[] = [
  ['Leche', 'pantry', 'cartones', 12, 2, 120],
  ['Café en grano', 'pantry', 'bolsas', 2, 0, 1440],
  ['Fideos', 'pantry', 'paquetes', 6, 4, 4320],
  ['Tomate en lata', 'pantry', 'latas', 8, 3, 5760],
  ['Aceite de oliva', 'pantry', 'botellas', 2, 2, 10080],
  ['Papel higiénico', 'bathroom', 'rollos', 24, 9, 360],
  ['Pasta dental', 'bathroom', 'tubos', 2, 2, 10080],
  ['Shampoo', 'bathroom', 'botellas', 1, 1, 20160],
  ['Jabón de manos', 'bathroom', 'repuestos', 2, 0, 7200],
  ['Pastillas lavavajillas', 'cleaning', 'paquetes', 2, 1, 4320],
  ['Jabón para ropa', 'cleaning', 'paquetes', 1, 1, 10080],
  ['Bolsas de residuos', 'cleaning', 'rollos', 2, 2, 10080],
  ['Rollo de cocina', 'cleaning', 'rollos', 4, 1, 2880],
].map(([name, category, unit, monthlyUsage, currentQty, minutesAgo]) => ({
  draft: { name, category, unit, monthlyUsage, currentQty } as ItemDraft,
  minutesAgo: minutesAgo as number,
}));
