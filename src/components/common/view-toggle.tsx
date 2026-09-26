"use client";

import { Kanban, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ViewMode = "list" | "kanban";

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => next && onChange(next as ViewMode)}
      aria-label="View mode"
    >
      <ToggleGroupItem value="list" aria-label="List view" className="h-9 px-2.5">
        <List />
      </ToggleGroupItem>
      <ToggleGroupItem value="kanban" aria-label="Kanban view" className="h-9 px-2.5">
        <Kanban />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
