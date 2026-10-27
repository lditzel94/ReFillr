import { Item } from '../core/models';

/** An item plus everything the list needs to render it. */
export interface ItemView {
  item: Item;
  need: number;
  /** "12/mes · 2 en casa · Ana · hace 2 horas" */
  detail: string;
}
