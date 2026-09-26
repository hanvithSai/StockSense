"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SCREENS = [
  { key: "dashboard", label: "Dashboard", caption: "KPIs, late and waiting work, low stock alerts and activity at a glance." },
  { key: "operation", label: "Operations", caption: "Odoo-style documents with status bar, live availability and an activity timeline." },
  { key: "stock", label: "Stock", caption: "On hand, reserved and free-to-use stock per product and location, updatable in place." },
  { key: "reports", label: "Reports", caption: "Valuation, movement value, on-time rate, lead time, top movers and slow movers." },
  { key: "moves", label: "Move history", caption: "Every movement between locations: incoming in green, outgoing in red." },
] as const;

/** Tabbed product screenshots in a browser frame. */
export function Showcase() {
  const [active, setActive] = useState<(typeof SCREENS)[number]["key"]>("dashboard");
  const screen = SCREENS.find((item) => item.key === active)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Product screens">
        {SCREENS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active === item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active === item.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">{screen.caption}</p>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 truncate rounded-md bg-background px-3 py-0.5 text-xs text-muted-foreground">stocksense.app/{screen.key}</span>
        </div>
        <Image
          key={screen.key}
          src={`/screens/${screen.key}.jpg`}
          alt={`${screen.label} screen`}
          width={2160}
          height={1350}
          className="animate-in fade-in h-auto w-full duration-500 dark:hidden"
          sizes="(min-width: 1280px) 1152px, 100vw"
        />
        <Image
          key={`${screen.key}-dark`}
          src={`/screens/${screen.key}-dark.jpg`}
          alt={`${screen.label} screen in dark mode`}
          width={2160}
          height={1350}
          className="animate-in fade-in hidden h-auto w-full duration-500 dark:block"
          sizes="(min-width: 1280px) 1152px, 100vw"
        />
      </div>
    </div>
  );
}
