import {
  ArrowDownToLine,
  ArrowLeftRight,
  Boxes,
  ChartColumn,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  RefreshCcw,
  ScrollText,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports", href: "/reports", icon: ChartColumn },
      { title: "Move History", href: "/move-history", icon: History },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Receipts", href: "/operations/receipts", icon: ArrowDownToLine },
      { title: "Delivery Orders", href: "/operations/deliveries", icon: Truck },
      { title: "Internal Transfers", href: "/operations/transfers", icon: ArrowLeftRight },
      { title: "Adjustments", href: "/operations/adjustments", icon: ClipboardCheck },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Products", href: "/products", icon: Package },
      { title: "Stock", href: "/stock", icon: Boxes },
      { title: "Categories", href: "/products/categories", icon: Tags },
      { title: "Reordering Rules", href: "/products/reordering", icon: RefreshCcw },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Warehouses", href: "/settings/warehouses", icon: Warehouse },
      { title: "Locations", href: "/settings/locations", icon: MapPin },
      { title: "Users", href: "/settings/users", icon: Users, capability: "users:manage" },
      { title: "Audit Log", href: "/settings/audit-log", icon: ScrollText, capability: "users:manage" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

/** The most specific nav item matching the current path (e.g. /products/categories over /products). */
export function activeNavItem(pathname: string) {
  return ALL_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
