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
import { useT } from "@/i18n/context";

export default function ForgotPasswordPage() {
  const id = useId();
  const [email, setEmail] = useState("");
  const request = useRequestPasswordReset();
  const t = useT("auth");

  return (
    <AuthCard
      eyebrow={t("forgot.eyebrow")}
      title={t("forgot.title")}
      description={t("forgot.description")}
      footer={
        <Link to="/login" className={authLinkClass}>
          {t("forgot.back")}
        </Link>
      }
    >
          {request.isSuccess ? (
            <Alert variant="success">
              <MailCheck aria-hidden />
              <AlertTitle>{t("forgot.checkEmail")}</AlertTitle>
              <AlertDescription>
                {t("forgot.sentBody", { email })}
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
                <Label htmlFor={id}>{t("email")}</Label>
                <Input id={id} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {request.isError ? <p role="alert" className="text-sm text-destructive">{getErrorMessage(request.error)}</p> : null}
              <Button type="submit" size="lg" className="w-full" loading={request.isPending}>
                {request.isPending ? t("forgot.submitting") : t("forgot.submit")}
              </Button>
            </form>
          )}
    </AuthCard>
  );
}
