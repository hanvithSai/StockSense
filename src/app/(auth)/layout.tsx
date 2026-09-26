import { ArrowDownToLine, ArrowLeftRight, ClipboardCheck, Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/server/auth/session";

const HIGHLIGHTS = [
  { icon: ArrowDownToLine, title: "Receipts", text: "Validate incoming goods and stock rises instantly." },
  { icon: Truck, title: "Deliveries", text: "Pick, pack and ship with live availability checks." },
  { icon: ArrowLeftRight, title: "Transfers", text: "Move stock between racks, floors and warehouses." },
  { icon: ClipboardCheck, title: "Adjustments", text: "Reconcile physical counts with a full audit trail." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#3b2536] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-dots pointer-events-none absolute inset-0 text-white/40" />
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-[#8a5a7f]/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-[#017e84]/25 blur-3xl" />
        <Logo className="relative [&_span_span]:text-[#e7b6da]" />
        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl leading-tight font-semibold tracking-tight">
              Every unit, every location, in real time.
            </h2>
            <p className="text-white/70">
              Replace registers and spreadsheets with one ledger for receipts, deliveries, transfers and counts.
            </p>
          </div>
          <ul className="grid gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <item.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-sm text-white/65">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">StockSense · Inventory Management System</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
