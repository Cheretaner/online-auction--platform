import { useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/auth-card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { useConfirmPasswordReset } from "@/features/auth/queries";
import { getErrorMessage } from "@/lib/api/errors";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = useConfirmPasswordReset();
  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  if (!token) {
    return (
      <AuthCard
        title="This link is incomplete"
        description="Open the link from your email again, or ask for a new one."
      >
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Choose a new password"
      description="After this you are signed out on every device and sign in with the new password."
    >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mismatch || password.length < 8) return;
              reset.mutate(
                { token, password },
                {
                  onSuccess: () => {
                    toast.success("Password changed. Sign in with your new password.");
                    navigate("/login", { replace: true });
                  },
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${id}-new`}>New password</Label>
              <Input id={`${id}-new`} aria-invalid={tooShort || undefined} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {tooShort ? (
                <p role="alert" className="text-xs font-medium text-destructive">Use at least 8 characters.</p>
              ) : (
                <FieldHint>At least 8 characters.</FieldHint>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-confirm`}>Repeat new password</Label>
              <Input id={`${id}-confirm`} aria-invalid={mismatch || undefined} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              {mismatch ? <p role="alert" className="text-xs font-medium text-destructive">The passwords do not match.</p> : null}
            </div>
            {reset.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(reset.error)}{" "}
                <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                  Request a new link
                </Link>
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={mismatch || password.length < 8}>
              {reset.isPending ? "Saving…" : "Set new password"}
            </Button>
          </form>
    </AuthCard>
  );
}
