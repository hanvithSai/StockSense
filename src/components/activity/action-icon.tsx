import {
  Archive,
  ArchiveRestore,
  Ban,
  CheckCheck,
  Circle,
  CircleCheck,
  Hand,
  Hourglass,
  KeyRound,
  LogIn,
  MessageSquareText,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Split,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  created: { icon: Plus, tone: "bg-primary/12 text-primary", label: "Created" },
  updated: { icon: Pencil, tone: "bg-muted text-muted-foreground", label: "Updated" },
  ready: { icon: CircleCheck, tone: "bg-info/12 text-sky-700 dark:text-sky-400", label: "Ready" },
  waiting: { icon: Hourglass, tone: "bg-warning/15 text-amber-600 dark:text-amber-400", label: "Waiting" },
  picked: { icon: Hand, tone: "bg-violet-500/12 text-violet-600 dark:text-violet-400", label: "Picked" },
  packed: { icon: PackageCheck, tone: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400", label: "Packed" },
  split: { icon: Split, tone: "bg-violet-500/12 text-violet-700 dark:text-violet-400", label: "Split" },
  validated: { icon: CheckCheck, tone: "bg-success/12 text-emerald-700 dark:text-emerald-400", label: "Validated" },
  cancelled: { icon: Ban, tone: "bg-destructive/10 text-destructive", label: "Cancelled" },
  reset: { icon: RotateCcw, tone: "bg-muted text-muted-foreground", label: "Reset" },
  deleted: { icon: Trash2, tone: "bg-destructive/10 text-destructive", label: "Deleted" },
  archived: { icon: Archive, tone: "bg-muted text-muted-foreground", label: "Archived" },
  restored: { icon: ArchiveRestore, tone: "bg-success/12 text-emerald-700 dark:text-emerald-400", label: "Restored" },
  imported: { icon: Upload, tone: "bg-primary/12 text-primary", label: "Imported" },
  note: { icon: MessageSquareText, tone: "bg-primary/12 text-primary", label: "Note" },
  signed_in: { icon: LogIn, tone: "bg-muted text-muted-foreground", label: "Signed in" },
  signed_up: { icon: UserPlus, tone: "bg-primary/12 text-primary", label: "Signed up" },
  password_reset: { icon: KeyRound, tone: "bg-warning/15 text-amber-600 dark:text-amber-400", label: "Password reset" },
  password_changed: { icon: KeyRound, tone: "bg-muted text-muted-foreground", label: "Password changed" },
  role_changed: { icon: ShieldCheck, tone: "bg-info/12 text-sky-700 dark:text-sky-400", label: "Role changed" },
  activated: { icon: UserCheck, tone: "bg-success/12 text-emerald-700 dark:text-emerald-400", label: "Activated" },
  deactivated: { icon: UserX, tone: "bg-destructive/10 text-destructive", label: "Deactivated" },
};

export function actionMeta(action: string) {
  return ACTIONS[action] ?? { icon: Circle, tone: "bg-muted text-muted-foreground", label: action };
}

export function ActionIcon({ action, className }: { action: string; className?: string }) {
  const { icon: Icon, tone } = actionMeta(action);
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card", tone, className)}>
      <Icon className="size-3.5" />
    </span>
  );
}
