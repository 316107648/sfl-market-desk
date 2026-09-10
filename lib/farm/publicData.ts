export type FarmPublicLookupStatus =
  | "idle"
  | "partial"
  | "unavailable"
  | "error";

export type FarmPublicField = {
  key: string;
  label: string;
  value?: string | number;
  source: "onchain" | "public-index" | "manual" | "unavailable";
  note?: string;
};

export type FarmPublicSnapshot = {
  landId: string;
  status: FarmPublicLookupStatus;
  provider: string;
  fetchedAt: number;
  fields: FarmPublicField[];
  unavailable: string[];
  notes: string[];
};

export type FarmPublicLookupResponse = {
  ok: boolean;
  snapshot?: FarmPublicSnapshot;
  error?: string;
};
