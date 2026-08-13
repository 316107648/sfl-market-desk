import { crops } from "./crops";
import { fruits } from "./fruits";
import { flowers } from "./flowers";
import type { GameItem } from "./types";
import { crafts } from "./crafts";

export const items: GameItem[] = [
  ...crops,
  ...fruits,
  ...flowers,
  ...crafts,
];