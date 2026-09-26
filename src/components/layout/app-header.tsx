"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AlertsBell } from "./alerts-bell";
import { LiveIndicator } from "./live-indicator";
import { activeNavItem } from "./nav-config";
import { SearchCommand } from "./search-command";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const title = pathname.startsWith("/profile") ? "My Profile" : active?.title;

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList>
          {active && (
            <>
              <BreadcrumbItem className="text-muted-foreground">{active.group}</BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage className="truncate">{title ?? "StockSense"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1.5">
        <LiveIndicator />
        <SearchCommand />
        <AlertsBell />
        <ThemeToggle />
      </div>
      <ShortcutsDialog />
    </header>
  );
}
