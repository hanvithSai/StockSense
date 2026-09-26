"use client";

import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useLocations } from "@/hooks/use-reference-data";
import { api } from "@/lib/api-client";
import { operationPath } from "@/lib/constants";

const STEPS = [
  "A draft adjustment lists every product stored at the location, pre-filled with the recorded quantity.",
  "Print the blind count sheet (recorded quantities hidden) and count the shelves.",
  "Type only the quantities that differ, then validate to correct the stock.",
];

function CountForm({ defaultLocation, onDone }: { defaultLocation: string; onDone: () => void }) {
  const router = useRouter();
  const { data: locations = [] } = useLocations();
  const [location, setLocation] = useState(defaultLocation);
  const [error, setError] = useState("");
  const start = useApiMutation<string, { id: string }>({
    mutationFn: (id) => api<{ id: string }>("/api/stock/count", { method: "POST", body: { location: id } }),
    success: "Count started",
    onSuccess: ({ id }) => {
      onDone();
      router.push(operationPath("adjustment", id));
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!location) return setError("Select the location to count");
    start.mutate(location);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <SelectField
        label="Location"
        required
        value={location}
        onChange={(value) => {
          setLocation(value);
          setError("");
        }}
        options={locations.map((item) => ({ value: item.id, label: item.fullName, hint: item.warehouse?.name }))}
        placeholder="Select a location"
        error={error}
      />
      <ol className="space-y-2 text-sm text-muted-foreground">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={start.isPending}>
          {start.isPending ? <Spinner /> : <ClipboardList />}
          Start count
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Starts a full physical count of one location (cycle count) as a draft inventory adjustment. */
export function CountLocationDialog({
  open,
  onOpenChange,
  defaultLocation = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLocation?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Count a location</DialogTitle>
          <DialogDescription>Recount everything stored in one rack or room and correct the differences in one go.</DialogDescription>
        </DialogHeader>
        {open && <CountForm key={defaultLocation} defaultLocation={defaultLocation} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
