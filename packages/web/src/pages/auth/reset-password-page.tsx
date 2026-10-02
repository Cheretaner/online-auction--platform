import { useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/auth-card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { useConfirmPasswordReset } from "@/features/auth/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { useT } from "@/i18n/context";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = useConfirmPasswordReset();
  const t = useT("auth");
  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  if (!token) {
    return (
      <AuthCard
        title={t("reset.incompleteTitle")}
        description={t("reset.incompleteBody")}
      >
        <Button asChild className="w-full">
          <Link to="/forgot-password">{t("reset.requestNew")}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={t("reset.eyebrow")}
      title={t("reset.title")}
      description={t("reset.description")}
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
                    toast.success(t("reset.changed"));
                    navigate("/login", { replace: true });
                  },
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${id}-new`}>{t("reset.newPassword")}</Label>
              <Input id={`${id}-new`} aria-invalid={tooShort || undefined} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {tooShort ? (
                <p role="alert" className="text-xs font-medium text-destructive">{t("reset.tooShort")}</p>
              ) : (
                <FieldHint>{t("reset.hint")}</FieldHint>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-confirm`}>{t("reset.repeat")}</Label>
              <Input id={`${id}-confirm`} aria-invalid={mismatch || undefined} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              {mismatch ? <p role="alert" className="text-xs font-medium text-destructive">{t("reset.mismatch")}</p> : null}
            </div>
            {reset.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(reset.error)}{" "}
                <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                  {t("reset.requestNew")}
                </Link>
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={mismatch || password.length < 8}>
              {reset.isPending ? t("reset.submitting") : t("reset.submit")}
            </Button>
          </form>
    </AuthCard>
  );
}
