import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/** Live checklist of the password policy. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", passed ? "text-success" : "text-muted-foreground")}>
            {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
