import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Boxes,
  ChartColumn,
  CheckCheck,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  History,
  KeyRound,
  LockKeyhole,
  Printer,
  ScanBarcode,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/format";
import type { LandingStats } from "@/server/services/landing";
import { Showcase } from "./showcase";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ArrowDownToLine, title: "Receipts", text: "Record vendor deliveries, receive in full or in part, and watch stock rise instantly." },
  { icon: Truck, title: "Delivery orders", text: "Reserve, scan to pick, pack and ship. Short orders wait for stock, or ship what is there and backorder the rest." },
  { icon: ArrowLeftRight, title: "Internal transfers", text: "Move goods between racks, production floors and warehouses in two clicks." },
  { icon: ClipboardCheck, title: "Stock adjustments", text: "Count a whole rack from a blind count sheet; only the differences are applied and logged." },
  { icon: History, title: "Stock ledger", text: "Every movement has a from and a to, a timestamp and an author. Nothing is lost." },
  { icon: Warehouse, title: "Multi-warehouse", text: "Warehouses with any number of locations, each with live on-hand and free stock." },
  { icon: Bell, title: "Forecasts and reordering", text: "Forecast = on hand + incoming − outgoing. Rules raise alerts and create replenishment receipts in one click." },
  { icon: ChartColumn, title: "Dashboards and reports", text: "Live KPIs, your own work queue, team activity, valuation, on-time rate and top movers." },
  { icon: ScanBarcode, title: "Scan, search and filter", text: "Scan barcodes into any document, find anything with Ctrl K, and switch between list, kanban and calendar views." },
  { icon: ScrollText, title: "Audit trail and notes", text: "An exportable history of who did what and when, plus team notes on every record." },
  { icon: FileSpreadsheet, title: "Excel in, Excel out", text: "Import products from CSV and export stock, moves and audit logs in one click." },
  { icon: Printer, title: "Barcodes and printing", text: "Print SKU labels, picking lists, count sheets, goods received notes and delivery slips." },
];

const WORKFLOW = [
  { step: "Receive", icon: ArrowDownToLine, detail: "100 kg steel from the vendor", change: "+100", balance: "100", tone: "text-emerald-700 dark:text-emerald-400" },
  { step: "Move", icon: ArrowLeftRight, detail: "40 kg main store → production rack", change: "0", balance: "100", tone: "text-sky-700 dark:text-sky-400" },
  { step: "Deliver", icon: Truck, detail: "20 kg shipped to the customer", change: "−20", balance: "80", tone: "text-rose-600 dark:text-rose-400" },
  { step: "Adjust", icon: ClipboardCheck, detail: "3 kg damaged, count corrected", change: "−3", balance: "77", tone: "text-rose-600 dark:text-rose-400" },
];

const TRUST: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Database, title: "ACID transactions", text: "Stock and documents change together or not at all: no half-applied moves." },
  { icon: ShieldCheck, title: "Role-based access", text: "Managers plan and configure; warehouse staff pick, move and count. Enforced by the API." },
  { icon: KeyRound, title: "OTP password reset", text: "Hashed six-digit codes with expiry, attempt limits and resend cooldown." },
  { icon: LockKeyhole, title: "Hardened sessions", text: "httpOnly cookies, lockout after failed logins, sessions revoked on password change." },
  { icon: CheckCheck, title: "Validated everywhere", text: "The same rules check every form in the browser and every request on the server." },
  { icon: UserCheck, title: "Accountability", text: "Every action is attributed to a person in the audit trail and the record timeline." },
];

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

interface LandingPageProps {
  signedIn: boolean;
  stats: LandingStats | null;
  demo: boolean;
}

export function LandingPage({ signedIn, stats, demo }: LandingPageProps) {
  const primaryHref = signedIn ? "/dashboard" : "/signup";
  const primaryLabel = signedIn ? "Open dashboard" : "Get started free";

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label="StockSense home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#workflow" className="hover:text-foreground">How it works</a>
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#security" className="hover:text-foreground">Security</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!signedIn && (
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 text-foreground/15 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
          <div className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-10 text-center sm:pt-24">
            <div className="animate-in fade-in slide-in-from-bottom-3 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm duration-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Real-time inventory management
            </div>
            <h1 className="animate-in fade-in slide-in-from-bottom-4 mx-auto mt-6 max-w-4xl text-4xl leading-[1.08] font-semibold tracking-tight duration-700 sm:text-6xl">
              Every unit, every location.
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-r from-primary via-fuchsia-600 to-teal-600 bg-clip-text text-transparent dark:via-fuchsia-400 dark:to-teal-400">
                In perfect sync.
              </span>
            </h1>
            <p className="animate-in fade-in slide-in-from-bottom-5 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground duration-700">
              StockSense replaces registers and spreadsheets with one live ledger for receipts, deliveries, transfers and
              stock counts, across every warehouse and rack.
            </p>
            <div className="animate-in fade-in slide-in-from-bottom-6 mt-8 flex flex-wrap justify-center gap-3 duration-700">
              <Button size="lg" asChild className="h-11 px-6 text-base">
                <Link href={primaryHref}>
                  {primaryLabel} <ArrowRight />
                </Link>
              </Button>
              {!signedIn && (
                <Button size="lg" variant="outline" asChild className="h-11 px-6 text-base">
                  <Link href="/login">Try the live demo</Link>
                </Button>
              )}
            </div>
            {demo && !signedIn && (
              <p className="mt-3 text-xs text-muted-foreground">
                Demo login: <span className="font-mono">manager / Manager@123</span>
              </p>
            )}

            <div className="animate-in fade-in zoom-in-95 relative mx-auto mt-14 max-w-5xl duration-1000">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-primary/25 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/20">
                <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-rose-400" />
                  <span className="size-2.5 rounded-full bg-amber-400" />
                  <span className="size-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 rounded-md bg-background px-3 py-0.5 text-xs text-muted-foreground">stocksense.app/dashboard</span>
                </div>
                <Image
                  src="/screens/dashboard.jpg"
                  alt="StockSense dashboard with KPIs, operations and low stock alerts"
                  width={2160}
                  height={1350}
                  priority
                  className="h-auto w-full dark:hidden"
                  sizes="(min-width: 1024px) 1024px, 100vw"
                />
                <Image
                  src="/screens/dashboard-dark.jpg"
                  alt="StockSense dashboard in dark mode"
                  width={2160}
                  height={1350}
                  className="hidden h-auto w-full dark:block"
                  sizes="(min-width: 1024px) 1024px, 100vw"
                />
              </div>
              <div className="animate-float absolute top-52 -left-8 hidden w-64 rounded-xl border bg-card/95 p-3 text-left shadow-xl backdrop-blur lg:block">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCheck className="size-4 text-emerald-500" /> Receipt validated
                </p>
                <p className="mt-1 text-xs text-muted-foreground">+15 LED Monitor 24&quot; into WH/Stock</p>
              </div>
              <div className="animate-float absolute -right-6 bottom-20 hidden w-64 rounded-xl border bg-card/95 p-3 text-left shadow-xl backdrop-blur [animation-delay:-3s] lg:block">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="size-4 text-amber-500" /> Low stock alert
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Bookshelf is below its reorder minimum</p>
              </div>
            </div>
          </div>
        </section>

        {/* Live stats */}
        {stats && (
          <section className="border-y bg-muted/30">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 text-center md:grid-cols-4">
              {[
                { value: stats.products, label: "products tracked", icon: Boxes },
                { value: stats.warehouses, label: "warehouses", icon: Warehouse },
                { value: stats.operations, label: "operations recorded", icon: ClipboardCheck },
                { value: stats.moves, label: "stock moves in the ledger", icon: History },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <item.icon className="mx-auto size-5 text-primary" />
                  <p className="text-3xl font-semibold tracking-tight tabular">{formatCompact(item.value)}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="pb-6 text-center text-xs text-muted-foreground">Live numbers from the demo workspace.</p>
          </section>
        )}

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionHeading
            eyebrow="Everything stock"
            title="One app for every stock movement"
            text="From the loading dock to the customer, every operation updates stock in real time and lands in the ledger."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <SectionHeading
              eyebrow="How it works"
              title="From dock to delivery, one ledger"
              text="Follow 100 kg of steel through StockSense. Every step is a document; every document updates stock and history."
            />
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <ol className="space-y-4">
                {WORKFLOW.map((item, index) => (
                  <li key={item.step} className="flex items-start gap-4 rounded-2xl border bg-card p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <item.icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Step {index + 1}</p>
                      <p className="font-semibold">{item.step}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/5">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="font-semibold">Stock ledger · Steel</p>
                    <p className="text-xs text-muted-foreground">STEEL001 · kg</p>
                  </div>
                  <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Low stock</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Operation</th>
                      <th className="px-5 py-2.5 text-right font-medium">Change</th>
                      <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {WORKFLOW.map((item) => (
                      <tr key={item.step}>
                        <td className="px-5 py-3">
                          <p className="font-medium">{item.step}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </td>
                        <td className={`px-5 py-3 text-right font-semibold tabular ${item.tone}`}>{item.change === "0" ? "moved" : item.change}</td>
                        <td className="px-5 py-3 text-right font-medium tabular">{item.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                  77 kg on hand: 37 kg in the main store and 40 kg on the production rack.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionHeading
            eyebrow="Product tour"
            title="Designed for the warehouse floor and the back office"
            text="Drag-and-drop kanban boards, keyboard shortcuts, barcode scanning, dark mode and a layout that works on a tablet at the dock."
          />
          <Showcase />
        </section>

        {/* Roles */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-20 md:grid-cols-2">
            {[
              {
                icon: Users,
                title: "Inventory managers",
                points: ["Plan receipts and delivery orders", "Manage products, categories and reordering rules", "Configure warehouses, locations and users", "Analyse valuation, service level and velocity"],
              },
              {
                icon: Boxes,
                title: "Warehouse staff",
                points: ["Pick, pack and validate deliveries", "Receive goods and shelve them", "Transfer stock between locations", "Count stock and correct differences"],
              },
            ].map((role) => (
              <div key={role.title} className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <role.icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{role.title}</h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {role.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <CheckCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionHeading
            eyebrow="Enterprise ready"
            title="Reliable by design"
            text="Inventory is money. StockSense treats every unit with the rigour of an accounting ledger."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((item) => (
              <div key={item.title} className="flex gap-4 rounded-2xl border bg-card p-5">
                <item.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#3b2536] px-6 py-16 text-center text-white">
            <div className="bg-dots pointer-events-none absolute inset-0 text-white/25" />
            <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-[#8a5a7f]/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-[#017e84]/30 blur-3xl" />
            <div className="relative space-y-5">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Retire the spreadsheet.</h2>
              <p className="mx-auto max-w-xl text-white/75">
                Set up your warehouses in minutes and give every team member one accurate, real-time view of stock.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" asChild className="h-11 bg-white px-6 text-base text-[#3b2536] hover:bg-white/90">
                  <Link href={primaryHref}>
                    {primaryLabel} <ArrowRight />
                  </Link>
                </Button>
                {!signedIn && (
                  <Button size="lg" variant="outline" asChild className="h-11 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white">
                    <Link href="/login">Sign in</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo className="scale-90" />
          <p>Inventory management for modern operations · Built for the Odoo x GCET Hackathon 2026</p>
        </div>
      </footer>
    </div>
  );
}
