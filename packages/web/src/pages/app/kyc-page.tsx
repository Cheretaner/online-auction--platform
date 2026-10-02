import { Link } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { VERIFICATION_DOCUMENT_TYPES, VerificationDocumentFields } from "@auction/shared";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyVerification, useSubmitVerification, useUploadDocument } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { canReviewKyc, formatDateTime } from "@/lib/format";

const DOCUMENT_LABELS: Record<(typeof VERIFICATION_DOCUMENT_TYPES)[number], string> = {
  national_id: "Fayda national ID",
  kebele_id: "Kebele ID",
  passport: "Passport",
};

export default function KycPage() {
  const { session, roles } = useAuth();
  const verification = useMyVerification();
  const record = verification.data;
  const status = session?.user.verificationStatus === "verified" ? "verified" : (record?.status ?? "unverified");
  const canSubmit = status === "unverified" || status === "rejected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity verification"
        description="Bids are accepted only from verified bidders. You verify once and can then bid on any auction."
        actions={
          canReviewKyc(roles) ? (
            <Button asChild variant="outline">
              <Link to="/app/kyc/review">Review queue</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Your status</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {verification.isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
          {status === "verified" ? <p>You are verified and can bid.</p> : null}
          {status === "pending" && record ? (
            <p>
              Submitted {formatDateTime(record.createdAt)} ({record.documentType.replaceAll("_", " ")}). A compliance
              officer will review it; you will get a notification when they decide.
            </p>
          ) : null}
          {status === "unverified" && !verification.isLoading ? <p>You have not submitted anything yet.</p> : null}
          {status === "rejected" && record ? (
            <Alert variant="destructive">
              <AlertTitle>Not accepted</AlertTitle>
              <AlertDescription>
                {record.decisionReason ?? "No reason was given."} Correct the details and submit again.
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
  const form = useForm({
    resolver: zodResolver(VerificationDocumentFields),
    defaultValues: { documentType: "national_id" as const, documentNumber: "" },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submit your document</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit(async (values) => {
              setFormError(null);
              if (!evidence) {
                setFormError("Upload a photo or scan of your document.");
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
                toast.success("Submitted for review");
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
                  <FormLabel>Document</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VERIFICATION_DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DOCUMENT_LABELS[type]}
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
                  <FormLabel>Document number(12 digit FIN no if fayda) </FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="kyc-evidence">Document image or scan</Label>
              <Input
                id="kyc-evidence"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">Only you and authorized compliance reviewers can access this file.</p>
            </div>
            {formError ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{formError}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || submit.isPending || upload.isPending}>
                {submitting ? "Submitting…" : "Submit for verification"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
