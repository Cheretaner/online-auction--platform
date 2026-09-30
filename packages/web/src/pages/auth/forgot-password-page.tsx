import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestPasswordReset } from "@/features/auth/queries";
import { getErrorMessage } from "@/lib/api/errors";

export default function ForgotPasswordPage() {
  const id = useId();
  const [email, setEmail] = useState("");
  const request = useRequestPasswordReset();

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We will email you a link to choose a new password. The link works for 30 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          {request.isSuccess ? (
            <p className="text-sm">
              If <strong>{email}</strong> has an account, a reset link is on its way. Check your inbox and spam folder.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                request.mutate(email.trim());
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={id}>Email</Label>
                <Input id={id} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {request.isError ? <p className="text-sm text-destructive">{getErrorMessage(request.error)}</p> : null}
              <Button type="submit" className="w-full" disabled={request.isPending}>
                {request.isPending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
