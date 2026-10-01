import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthCard, authLinkClass } from "@/features/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestPasswordReset } from "@/features/auth/queries";
import { getErrorMessage } from "@/lib/api/errors";

export default function ForgotPasswordPage() {
  const id = useId();
  const [email, setEmail] = useState("");
  const request = useRequestPasswordReset();

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset your password"
      description="We will email you a link to choose a new password. The link works for 30 minutes."
      footer={
        <Link to="/login" className={authLinkClass}>
          Back to sign in
        </Link>
      }
    >
          {request.isSuccess ? (
            <Alert variant="success">
              <MailCheck aria-hidden />
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>
                If <strong className="text-foreground">{email}</strong> has an account, a reset link is on its way.
                Check your inbox and spam folder.
              </AlertDescription>
            </Alert>
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
              {request.isError ? <p role="alert" className="text-sm text-destructive">{getErrorMessage(request.error)}</p> : null}
              <Button type="submit" size="lg" className="w-full" loading={request.isPending}>
                {request.isPending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
    </AuthCard>
  );
}
