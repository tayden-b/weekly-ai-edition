import type { ItemView } from "../types";
import { Item } from "./Item";

/** ItemList — items stacked, separated by hairlines (DESIGN §2.1). */
export function ItemList({ items }: { items: ItemView[] }) {
  return (
    <div className="w-item-list">
      {items.map((item, i) => (
        <Item key={`${item.headline}-${i}`} item={item} />
      ))}
    </div>
  );
}
