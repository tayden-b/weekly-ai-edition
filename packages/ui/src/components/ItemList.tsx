import type { ItemView } from "../types";
import { Item } from "./Item";

/** ItemList — items stacked, separated by hairlines (DESIGN §2.1). */
export function ItemList({
  items,
  headlineAs,
}: {
  items: ItemView[];
  /** Forwarded to Item — h2 when the page title is an h1 (standalone page). */
  headlineAs?: "h2" | "h3";
}) {
  return (
    <div className="w-item-list">
      {items.map((item, i) => (
        <Item
          key={`${item.headline}-${i}`}
          item={item}
          {...(headlineAs ? { headlineAs } : {})}
        />
      ))}
    </div>
  );
}
