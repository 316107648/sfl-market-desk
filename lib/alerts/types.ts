export type PriceAlertDirection = "above" | "below";

export type PriceAlertRule = {
  id: string;
  asset: string;
  direction: PriceAlertDirection;
  target: number;
  enabled: boolean;
  createdAt: number;
};

export type PriceAlertRuntime = {
  isTriggered: boolean;
  lastNotifiedAt?: number;
};
