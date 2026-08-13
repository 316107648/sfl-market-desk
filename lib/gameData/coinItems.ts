import { getCoinItems } from "./gameDatabase";

export const coinItems = getCoinItems().map((item) => ({
  name: item.name,
  coins: item.coinValue!,
}));