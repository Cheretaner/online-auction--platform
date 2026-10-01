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
import { canReviewKyc, formatDateTime } from "@/lib/format";

const DOCUMENT_OPTIONS = [
  { value: "national_id", label: "Fayda national ID" },
  { value: "kebele_id", label: "Kebele ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving licence" },
  { value: "business_license", label: "Business licence (companies)" },
];

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
            <CardTitle>Your status</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="text-sm">
          {verification.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : status === "verified" ? (
            <Alert variant="success">
              <CircleCheck aria-hidden />
              <AlertTitle>You are verified</AlertTitle>
              <AlertDescription>You can bid on any auction once its bid security requirement is met.</AlertDescription>
            </Alert>
          ) : status === "pending" && record ? (
            <Alert variant="warning">
              <Clock aria-hidden />
              <AlertTitle>Under review</AlertTitle>
              <AlertDescription>
                Submitted {formatDateTime(record.createdAt)} ({record.documentType.replaceAll("_", " ")}). A compliance
                officer will review it; you will get a notification when they decide.
              </AlertDescription>
            </Alert>
          ) : status === "unverified" ? (
            <Alert>
              <ShieldAlert aria-hidden />
              <AlertTitle>Not verified yet</AlertTitle>
              <AlertDescription>Submit one identity document below. You only need to do this once.</AlertDescription>
            </Alert>
          ) : null}
          {status === "rejected" && record ? (
            <Alert variant="destructive">
              <XCircle aria-hidden />
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
  const form = useForm({
    resolver: zodResolver(SubmitVerificationRequest),
    defaultValues: { documentType: "national_id", documentNumber: "" },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit your document</CardTitle>
        <CardDescription>Enter the number exactly as printed. Only compliance officers can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              submit.mutate(values, {
                onSuccess: () => toast.success("Submitted for review"),
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
                  <FormLabel>Document</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                  <FormLabel>Document number</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={submit.isPending}>
                {submit.isPending ? "Submitting…" : "Submit for verification"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
