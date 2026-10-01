import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldHint, Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Asks for a written reason before a consequential action (reject, cancel,
 * withdraw, resolve). The API requires these reasons and records them in the
 * audit trail, so the dialog enforces the same minimum length up front.
 */
export function ReasonDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  confirmLabel: string;
  minLength?: number;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Mounted only while open, so the typed reason resets each time. */}
      {props.open ? <ReasonDialogBody {...props} /> : null}
    </Dialog>
  );
}

function ReasonDialogBody({
  onOpenChange,
  title,
  description,
  label = "Reason",
  confirmLabel,
  minLength = 4,
  pending,
  destructive,
  onConfirm,
}: Parameters<typeof ReasonDialog>[0]) {
  const id = useId();
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < minLength;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!tooShort) onConfirm(reason.trim());
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={id}>{label}</Label>
          <Textarea id={id} aria-describedby={`${id}-hint`} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} autoFocus />
          <FieldHint id={`${id}-hint`}>
            {reason.trim().length}/{minLength} characters minimum. This is recorded in the audit trail.
          </FieldHint>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={tooShort} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
