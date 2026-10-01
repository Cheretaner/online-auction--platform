import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAuctionRequest } from "@auction/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
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
      <PageHeader title={isEdit ? "Amend auction" : "Create auction"} />
      {!organizationId ? (
        <p className="text-sm text-destructive">
          Organization context is required.
        </p>
      ) : (
        <Form {...form}>
          <form
            className="grid max-w-3xl gap-4 sm:grid-cols-2"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
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
                    <FormLabel>Type</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="startPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start price</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minIncrement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min increment</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="depositAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="opensAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opens</FormLabel>
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
                  <FormLabel>Closes</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="sm:col-span-2"
              disabled={create.isPending || update.isPending}
            >
              {isEdit ? "Save changes" : "Create auction"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
