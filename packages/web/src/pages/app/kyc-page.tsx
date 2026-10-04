import { Link } from "react-router-dom";
import { useState } from "react";
import { CircleCheck, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { VERIFICATION_DOCUMENT_TYPES, VerificationDocumentFields } from "@auction/shared";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyVerification, useSubmitVerification, useUploadDocument } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { canReviewKyc, enumLabel, formatDateTime } from "@/lib/format";
import { useT } from "@/i18n/context";

export default function KycPage() {
  const { session, roles } = useAuth();
  const verification = useMyVerification();
  const record = verification.data;
  const status = session?.user.verificationStatus === "verified" ? "verified" : (record?.status ?? "unverified");
  const canSubmit = status === "unverified" || status === "rejected";
  const t = useT("account");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("kyc.title")}
        description={t("kyc.description")}
        actions={
          canReviewKyc(roles) ? (
            <Button asChild variant="outline">
              <Link to="/app/kyc/review">{t("kyc.reviewQueue")}</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("kyc.yourStatus")}</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="text-sm">
          {verification.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : status === "verified" ? (
            <Alert variant="success">
              <CircleCheck aria-hidden />
              <AlertTitle>{t("kyc.verifiedTitle")}</AlertTitle>
              <AlertDescription>{t("kyc.verifiedBody")}</AlertDescription>
            </Alert>
          ) : status === "pending" && record ? (
            <Alert variant="warning">
              <Clock aria-hidden />
              <AlertTitle>{t("kyc.pendingTitle")}</AlertTitle>
              <AlertDescription>
                {t("kyc.pendingBody", { date: formatDateTime(record.createdAt), document: enumLabel(record.documentType) })}
              </AlertDescription>
            </Alert>
          ) : status === "unverified" ? (
            <Alert>
              <ShieldAlert aria-hidden />
              <AlertTitle>{t("kyc.unverifiedTitle")}</AlertTitle>
              <AlertDescription>{t("kyc.unverifiedBody")}</AlertDescription>
            </Alert>
          ) : null}
          {status === "rejected" && record ? (
            <Alert variant="destructive">
              <XCircle aria-hidden />
              <AlertTitle>{t("kyc.rejectedTitle")}</AlertTitle>
              <AlertDescription>
                {record.decisionReason ?? t("kyc.noReason")} {t("kyc.correctAndResubmit")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {canSubmit ? <SubmitForm /> : null}
    </div>
  );
}

function SubmitForm() {
  const submit = useSubmitVerification();
  const upload = useUploadDocument();
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const t = useT("account");
  const form = useForm({
    resolver: zodResolver(VerificationDocumentFields),
    defaultValues: { documentType: "national_id" as const, documentNumber: "" },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("kyc.submitTitle")}</CardTitle>
        <CardDescription>{t("kyc.submitDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="warning" className="mb-4">
          <ShieldAlert aria-hidden />
          <AlertTitle>{t("kyc.manualReviewTitle")}</AlertTitle>
          <AlertDescription>{t("kyc.manualReviewBody")}</AlertDescription>
        </Alert>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit(async (values) => {
              setFormError(null);
              if (!evidence) {
                setFormError(t("kyc.evidenceRequired"));
                return;
              }
              setSubmitting(true);
              try {
                const body = new FormData();
                body.set("file", evidence);
                body.set("docType", "identity_document");
                body.set("isPrivate", "true");
                const document = await upload.mutateAsync(body);
                await submit.mutateAsync({ ...values, documentId: document.id });
                toast.success(t("kyc.submitted"));
              } catch (error) {
                if (!applyApiFieldErrors(error, form.setError)) setFormError(getErrorMessage(error));
              } finally {
                setSubmitting(false);
              }
            })}
          >
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("kyc.document")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VERIFICATION_DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {enumLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("kyc.documentNumberHint")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="kyc-evidence">{t("kyc.evidence")}</Label>
              <Input
                id="kyc-evidence"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">{t("kyc.evidenceHint")}</p>
            </div>
            {formError ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{formError}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" loading={submitting || submit.isPending || upload.isPending}>
                {submitting ? t("kyc.submitting") : t("kyc.submit")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
