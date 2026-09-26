"use client";

import { ArrowRight, CircleCheck, Circle, Rocket, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GettingStartedProps {
  hasWarehouse: boolean;
  hasProducts: boolean;
  hasReceipt: boolean;
  hasDelivery: boolean;
}

/** First-run checklist for a new workspace; disappears once every step is done. */
export function GettingStarted({ hasWarehouse, hasProducts, hasReceipt, hasDelivery }: GettingStartedProps) {
  const [hidden, setHidden] = useState(false);
  const steps = [
    { title: "Create your first warehouse", text: "Sites and their racks or rooms.", href: "/settings/warehouses", done: hasWarehouse },
    { title: "Add products", text: "One by one, or import your spreadsheet as CSV.", href: "/products?new=1", done: hasProducts },
    { title: "Receive stock", text: "Validate a receipt and watch stock rise.", href: "/operations/receipts/new", done: hasReceipt },
    { title: "Ship a delivery", text: "Reserve, pick, pack and validate.", href: "/operations/deliveries/new", done: hasDelivery },
  ];
  const completed = steps.filter((step) => step.done).length;
  if (hidden || completed === steps.length) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/8 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="size-4 text-primary" /> Get started with StockSense
        </CardTitle>
        <CardDescription>
          {completed} of {steps.length} steps done. It takes about five minutes.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={() => setHidden(true)} aria-label="Hide checklist">
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(completed / steps.length) * 100} className="h-1.5" />
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className={cn(
                  "group flex h-full items-start gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40",
                  step.done && "opacity-70",
                )}
              >
                {step.done ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", step.done && "line-through")}>{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.text}</span>
                </span>
                {!step.done && <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />}
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
