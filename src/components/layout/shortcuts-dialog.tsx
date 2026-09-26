"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export const SHORTCUTS_EVENT = "stocksense:shortcuts";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Search products and documents, run quick actions" },
  { keys: ["Ctrl", "S"], label: "Save the document you are editing" },
  { keys: ["Ctrl", "Enter"], label: "Post a note in the activity timeline" },
  { keys: ["Enter"], label: "Add the product typed or scanned in “Scan or type a SKU”" },
  { keys: ["Drag"], label: "Move a kanban card to change the operation's status" },
  { keys: ["?"], label: "Show this list" },
];

/** Keyboard shortcuts reference, opened with "?" or from the user menu. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SHORTCUTS_EVENT, onOpen);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster on the warehouse floor and in the office. On a Mac, use ⌘ instead of Ctrl.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl border">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>{shortcut.label}</span>
              <KbdGroup>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
