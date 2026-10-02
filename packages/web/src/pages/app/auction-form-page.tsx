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
import { enumLabel, toDatetimeLocalValue } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/errors";
import { useEffect } from "react";
import type { z } from "zod";
import { useT } from "@/i18n/context";

export default function AuctionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { organizationId } = useAuth();
  const existing = useAuction(id);
  const create = useCreateAuction();
  const update = useUpdateAuction(id ?? "");
  const navigate = useNavigate();
  const t = useT("workspace");
  const tc = useT("common");

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
        back={isEdit && id ? { to: `/app/auctions/${id}`, label: t("form.backToAuction") } : { to: "/app/auctions", label: t("form.backToList") }}
        title={isEdit ? t("form.amendTitle") : t("form.createTitle")}
        description={
          isEdit
            ? t("form.amendDescription")
            : t("form.createDescription")
        }
      />
      {!organizationId ? (
        <EmptyState
          icon={Building2}
          title={t("list.chooseOrgTitle")}
          description={t("list.chooseOrgBody")}
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
                  toast.success(t("form.updated"));
                  navigate(`/app/auctions/${id}`);
                } else {
                  const created = await create.mutateAsync(values);
                  toast.success(t("form.created"));
                  navigate(`/app/auctions/${created.id}`);
                }
              } catch (error) {
                if (!applyApiFieldErrors(error, form.setError)) {
                  toast.error(getErrorMessage(error));
                }
              }
            })}
          >
            <Card>
              <CardHeader>
                <CardTitle>{t("form.basics")}</CardTitle>
                <CardDescription>{t("form.basicsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("form.title")}</FormLabel>
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
                        {t("form.description")}
                        <OptionalHint />
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={5} {...field} />
                      </FormControl>
                      <FormDescription>{t("form.descriptionHint")}</FormDescription>
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
                        <FormLabel>{t("form.format")}</FormLabel>
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
                              {enumLabel("open_ascending")}
                            </SelectItem>
                            <SelectItem value="sealed_bid">{enumLabel("sealed_bid")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>{t("form.formatHint")}</FormDescription>
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
                        {t("form.region")}
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
                <CardTitle>{t("form.pricing")}</CardTitle>
                <CardDescription>{t("form.pricingDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="startPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.startPrice", { currency: tc("currency") })}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>{t("form.startPriceHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="minIncrement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.increment", { currency: tc("currency") })}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>{t("form.incrementHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
    <FormField
                  control={form.control}
                  name="depositAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.deposit", { currency: tc("currency") })}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormDescription>{t("form.depositHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("form.schedule")}</CardTitle>
                <CardDescription>{t("form.scheduleDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
    <FormField
                  control={form.control}
                  name="opensAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.opens")}</FormLabel>
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
                      <FormLabel>{t("form.closes")}</FormLabel>
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
                {tc("cancel")}
              </Button>
              <Button type="submit" size="lg" loading={create.isPending || update.isPending}>
                {isEdit ? t("form.save") : t("form.create")}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
