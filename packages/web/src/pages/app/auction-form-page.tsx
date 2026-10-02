import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAuctionRequest } from "@auction/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionalHint } from "@/components/ui/label";
import { EmptyState } from "@/components/feedback/query-state";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import {
  useAuction,
  useCreateAuction,
  useUpdateAuction,
} from "@/features/auctions/queries";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { toDatetimeLocalValue } from "@/lib/format";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { useEffect } from "react";
import type { z } from "zod";

export default function AuctionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { organizationId } = useAuth();
  const existing = useAuction(id);
  const create = useCreateAuction();
  const update = useUpdateAuction(id ?? "");
  const navigate = useNavigate();

  const form = useForm<z.input<typeof CreateAuctionRequest>, unknown, z.output<typeof CreateAuctionRequest>>({
    resolver: zodResolver(CreateAuctionRequest),
    defaultValues: {
      organizationId: organizationId ?? "",
      title: "",
      description: "",
      auctionType: "open_ascending" as const,
      startPrice: "0.00",
      reservePrice: "",
      minIncrement: "1.00",
      depositAmount: "0.00",
      eligibilityRules: "",
      region: "",
      opensAt: "",
      closesAt: "",
    },
  });

  useEffect(() => {
    if (organizationId) form.setValue("organizationId", organizationId);
  }, [form, organizationId]);

  useEffect(() => {
    const auction = existing.data;
    if (!auction || !isEdit) return;
    form.reset({
      organizationId: auction.orgId,
      title: auction.title,
      description: auction.description ?? "",
      auctionType: auction.auctionType,
      startPrice: auction.startPrice,
      reservePrice: auction.reservePrice ?? "",
      minIncrement: auction.minIncrement,
      depositAmount: auction.depositAmount,
      eligibilityRules: auction.eligibilityRules ?? "",
      region: auction.region ?? "",
      opensAt: toDatetimeLocalValue(auction.opensAt),
      closesAt: toDatetimeLocalValue(auction.closesAt),
    });
  }, [existing.data, form, isEdit]);

  return (
    <div>
      <PageHeader
        back={isEdit && id ? { to: `/app/auctions/${id}`, label: "Back to auction" } : { to: "/app/auctions", label: "Workspace auctions" }}
        title={isEdit ? "Amend auction" : "Create auction"}
        description={
          isEdit
            ? "Drafts can be changed freely until they are submitted for review."
            : "Saved as a draft. Add lots and documents next, then submit it for review."
        }
      />
      {!organizationId ? (
        <EmptyState
          icon={Building2}
          title="Choose an organization first"
          description="Auctions belong to an organization. Pick one with the organization switcher in the top bar."
        />
      ) : (
        <Form {...form}>
          <form
            className="max-w-3xl space-y-6"
            onSubmit={form.handleSubmit(async (values) => {
              const payload = {
                ...values,
                reservePrice: values.reservePrice || undefined,
                description: values.description || undefined,
                eligibilityRules: values.eligibilityRules || undefined,
                region: values.region || undefined,
              };
              try {
                if (isEdit && id) {
                  await update.mutateAsync({
                    ...payload,
                    opensAt: values.opensAt.toISOString(),
                    closesAt: values.closesAt.toISOString(),
                  });
                  toast.success("Auction updated");
                  navigate(`/app/auctions/${id}`);
                } else {
                  // Use the normalized payload above so blank optional fields
                  // (especially reservePrice) are omitted instead of failing
                  // the API's money validation.
                  const created = await create.mutateAsync(payload);
                  toast.success("Auction created");
                  navigate(`/app/auctions/${created.id}`);
                }
              } catch (error) {
                applyApiFieldErrors(error, form.setError);
                if (isApiError(error)) {
                  const firstFieldError = Object.entries(error.fieldErrors).find(([, messages]) => messages[0]);
                  const detail = firstFieldError
                    ? `${firstFieldError[0]}: ${firstFieldError[1][0]}`
                    : error.formErrors[0];
                  toast.error(detail ? `${error.message} — ${detail}` : error.message);
                } else {
                  toast.error(getErrorMessage(error));
                }
              }
            }, (errors) => {
              const firstError = Object.entries(errors).find(([, fieldError]) => fieldError?.message);
              toast.error(firstError
                ? `${firstError[0]}: ${String(firstError[1]?.message)}`
                : "Please check the form fields and try again.");
            })}
          >
            <Card>
              <CardHeader>
                <CardTitle>Basics</CardTitle>
                <CardDescription>What is being sold, as bidders will see it.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        Description
                        <OptionalHint />
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={5} {...field} />
                      </FormControl>
                      <FormDescription>Condition, location and anything bidders must know before taking part.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    {!isEdit ? (
                  <FormField
                    control={form.control}
                    name="auctionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auction format</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isEdit}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open_ascending">
                              Open ascending
                            </SelectItem>
                            <SelectItem value="sealed_bid">Sealed bid</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Cannot be changed after the auction is created.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
    <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Region
                        <OptionalHint />
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pricing and bid security</CardTitle>
                <CardDescription>Amounts in Ethiopian birr.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="startPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start price (ETB)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>The lowest acceptable first bid.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="minIncrement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum increment (ETB)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>Each new bid must beat the highest by at least this much.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="depositAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bid security (ETB)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>CPO or guarantee bidders must lodge. Use 0 for none.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>Times are in your local time zone. A second person must approve the auction before it opens.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="opensAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bidding opens</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={typeof field.value === "string" ? field.value : ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="closesAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bidding closes</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={typeof field.value === "string" ? field.value : ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate(isEdit && id ? `/app/auctions/${id}` : "/app/auctions")}>
                Cancel
              </Button>
              <Button type="submit" size="lg" loading={create.isPending || update.isPending}>
                {isEdit ? "Save changes" : "Create draft auction"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
