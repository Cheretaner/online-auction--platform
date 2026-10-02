import { Link } from "react-router-dom";
import { CircleCheck, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitVerificationRequest } from "@auction/shared";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyVerification, useSubmitVerification } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { canReviewKyc, enumLabel, formatDateTime } from "@/lib/format";
import { useT } from "@/i18n/context";

const DOCUMENT_OPTIONS = ["national_id", "kebele_id", "passport", "driving_license", "business_license"] as const;

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
  const t = useT("account");
  const form = useForm({
    resolver: zodResolver(SubmitVerificationRequest),
    defaultValues: { documentType: "national_id", documentNumber: "" },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("kyc.submitTitle")}</CardTitle>
        <CardDescription>{t("kyc.submitDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              submit.mutate(values, {
                onSuccess: () => toast.success(t("kyc.submitted")),
                onError: (error) => {
                  if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
                },
              }),
            )}
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
                      {DOCUMENT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === "business_license" ? t("kyc.businessLicence") : enumLabel(option)}
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
                  <FormLabel>{t("kyc.documentNumber")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={submit.isPending}>
                {submit.isPending ? t("kyc.submitting") : t("kyc.submit")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
