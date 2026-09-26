"use client";

import { CalendarDays, Kanban, List, type LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ViewMode = "list" | "kanban" | "calendar";

const MODES: Record<ViewMode, { label: string; icon: LucideIcon }> = {
  list: { label: "List view", icon: List },
  kanban: { label: "Kanban view", icon: Kanban },
  calendar: { label: "Calendar view", icon: CalendarDays },
};

export function ViewToggle({
  value,
  onChange,
  modes = ["list", "kanban"],
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  modes?: ViewMode[];
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => next && onChange(next as ViewMode)}
      aria-label="View mode"
    >
      {modes.map((mode) => {
        const { label, icon: Icon } = MODES[mode];
        return (
          <ToggleGroupItem key={mode} value={mode} aria-label={label} title={label} className="h-9 px-2.5">
            <Icon />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
