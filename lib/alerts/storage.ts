import type { PriceAlertRule, PriceAlertRuntime } from "./types";

export const TELEGRAM_ALERT_RULES_KEY = "smp:telegram-alert-rules:v1";
export const TELEGRAM_ALERT_RUNTIME_KEY = "smp:telegram-alert-runtime:v1";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadAlertRules(): PriceAlertRule[] {
  if (typeof window === "undefined") return [];
  return safeParse<PriceAlertRule[]>(
    window.localStorage.getItem(TELEGRAM_ALERT_RULES_KEY),
    [],
  );
}

export function saveAlertRules(rules: PriceAlertRule[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TELEGRAM_ALERT_RULES_KEY, JSON.stringify(rules));
  window.dispatchEvent(new Event("smp:telegram-alert-rules-changed"));
}

export function loadAlertRuntime(): Record<string, PriceAlertRuntime> {
  if (typeof window === "undefined") return {};
  return safeParse<Record<string, PriceAlertRuntime>>(
    window.localStorage.getItem(TELEGRAM_ALERT_RUNTIME_KEY),
    {},
  );
}

export function saveAlertRuntime(
  runtime: Record<string, PriceAlertRuntime>,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    TELEGRAM_ALERT_RUNTIME_KEY,
    JSON.stringify(runtime),
  );
}
