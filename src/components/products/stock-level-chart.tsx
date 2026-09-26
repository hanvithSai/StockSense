"use client";

import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatDateTime, formatQty } from "@/lib/format";
import type { LedgerRowDTO } from "@/lib/types";

const config = { balance: { label: "On hand", color: "var(--chart-1)" } } satisfies ChartConfig;

/** On-hand quantity after each validated movement, with the reorder minimum as a reference. */
export function StockLevelChart({ rows, uom, minQty }: { rows: LedgerRowDTO[]; uom: string; minQty: number | null }) {
  const history = [...rows].reverse().map((row) => ({ date: row.date, balance: row.balance, reference: row.reference }));

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Stock level</CardTitle>
        <CardDescription>On hand after each validated movement{minQty !== null ? ", with the reorder minimum" : ""}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <AreaChart data={history} margin={{ left: 4, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => format(new Date(value), "d MMM")}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => formatQty(value)} />
            {minQty !== null && (
              <ReferenceLine
                y={minQty}
                stroke="var(--warning)"
                strokeDasharray="5 4"
                label={{ value: `Reorder min ${formatQty(minQty)}`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
              />
            )}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload as { reference?: string; date?: string } | undefined;
                    return point ? `${point.reference} · ${formatDateTime(point.date)}` : "";
                  }}
                  formatter={(value) => (
                    <span className="font-mono font-medium tabular">
                      {formatQty(Number(value))} {uom} on hand
                    </span>
                  )}
                />
              }
            />
            <Area dataKey="balance" type="stepAfter" stroke="var(--color-balance)" fill="url(#balance-fill)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
