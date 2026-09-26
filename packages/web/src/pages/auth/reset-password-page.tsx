import { useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="mx-auto max-w-md space-y-3 text-sm">
        <p>This reset link is incomplete. Open the link from your email again, or ask for a new one.</p>
        <Link to="/forgot-password" className="text-primary underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>After this you are signed out on every device and sign in with the new password.</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor={`${id}-new`}>New password (at least 8 characters)</Label>
              <Input id={`${id}-new`} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {tooShort ? <p className="text-xs text-destructive">Use at least 8 characters.</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-confirm`}>Repeat new password</Label>
              <Input id={`${id}-confirm`} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              {mismatch ? <p className="text-xs text-destructive">The passwords do not match.</p> : null}
            </div>
            {reset.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(reset.error)}{" "}
                <Link to="/forgot-password" className="underline">
                  Request a new link
                </Link>
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={reset.isPending || mismatch || password.length < 8}>
              {reset.isPending ? "Saving…" : "Set new password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
