"use client";

import { useEffect, useState } from "react";
import type { PriceMap } from "../../lib/market";
import {
  loadAlertRules,
  loadAlertRuntime,
  saveAlertRuntime,
  type PriceAlertRule,
} from "../../lib/alerts";

type TelegramAlertWatcherProps = {
  prices: PriceMap;
};

const COOLDOWN_MS = 10 * 60 * 1000;

function triggered(rule: PriceAlertRule, price: number) {
  return rule.direction === "above"
    ? price >= rule.target
    : price <= rule.target;
}

export default function TelegramAlertWatcher({
  prices,
}: TelegramAlertWatcherProps) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener("smp:telegram-alert-rules-changed", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("smp:telegram-alert-rules-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const rules = loadAlertRules().filter((rule) => rule.enabled);
    if (rules.length === 0) return;

    const runtime = loadAlertRuntime();
    let changed = false;

    void Promise.all(
      rules.map(async (rule) => {
        const price = prices[rule.asset];
        if (!Number.isFinite(price)) return;

        const isTriggered = triggered(rule, price);
        const previous = runtime[rule.id];

        // On the first observation we only establish the current side of the
        // threshold. This avoids firing every existing alert immediately on load.
        if (!previous) {
          runtime[rule.id] = { isTriggered };
          changed = true;
          return;
        }

        const crossedIntoTrigger = !previous.isTriggered && isTriggered;
        const cooledDown =
          !previous.lastNotifiedAt ||
          Date.now() - previous.lastNotifiedAt >= COOLDOWN_MS;

        if (crossedIntoTrigger && cooledDown) {
          try {
            const response = await fetch("/api/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "price-alert",
                asset: rule.asset,
                price,
                target: rule.target,
                direction: rule.direction,
              }),
            });

            if (response.ok) {
              runtime[rule.id] = {
                isTriggered,
                lastNotifiedAt: Date.now(),
              };
              changed = true;
              return;
            }
          } catch {
            // Keep the previous notification timestamp so a later market update
            // can retry the notification.
          }
        }

        if (previous.isTriggered !== isTriggered) {
          runtime[rule.id] = {
            ...previous,
            isTriggered,
          };
          changed = true;
        }
      }),
    ).then(() => {
      if (changed) saveAlertRuntime(runtime);
    });
  }, [prices, revision]);

  return null;
}
