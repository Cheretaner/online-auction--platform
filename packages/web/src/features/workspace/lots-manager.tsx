import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAuctionItemRequest, ITEM_CONDITIONS } from "@auction/shared";
import { Lock, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, PageSkeleton } from "@/components/feedback/query-state";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAuctionItems,
  useCreateAuctionItem,
  useDeleteAuctionItem,
  useUpdateAuctionItem,
} from "@/features/auctions/queries";
import { useCategories } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { AuctionItem } from "@/lib/api/types";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { enumLabel, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";

const NO_CATEGORY = "none";

/** Lots are editable only while the auction is still a draft; the API
 * enforces the same rule. */
export function LotsManager({ auctionId, editable }: { auctionId: string; editable: boolean }) {
  const items = useAuctionItems(auctionId);
  const remove = useDeleteAuctionItem(auctionId);
  const [editing, setEditing] = useState<AuctionItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<AuctionItem | null>(null);
  const list = items.data?.items ?? [];
  const t = useT("workspace");

  return (
    <div className="space-y-4">
      {editable ? (
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden /> {t("lots.add")}
        </Button>
      ) : (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden /> {t("lots.locked")}
        </p>
      )}
      {items.isLoading ? <PageSkeleton rows={2} /> : null}
      {!items.isLoading && list.length === 0 ? (
        <EmptyState
          size="inline"
          icon={Package}
          title={t("lots.emptyTitle")}
          description={editable ? t("lots.emptyBody") : undefined}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                {editable ? (
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={t("lots.edit", { title: item.title })} onClick={() => setEditing(item)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={t("lots.delete", { title: item.title })} onClick={() => setDeleting(item)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
              <p className="text-xs text-muted-foreground capitalize">
                {t("lots.summary", { quantity: item.quantity, unit: item.unit ?? "" })}
                {item.condition ? ` · ${enumLabel(item.condition)}` : ""}
                {item.estimatedValue ? ` · ${t("lots.estimate", { amount: formatMoney(item.estimatedValue) })}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing ? (
        <LotDialog auctionId={auctionId} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("lots.deleteTitle")}
        description={t("lots.deleteDescription", { title: deleting?.title ?? "" })}
        confirmLabel={t("lots.deleteTitle")}
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("lots.deleted"));
              setDeleting(null);
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />
    </div>
  );
}

function LotDialog({ auctionId, item, onClose }: { auctionId: string; item: AuctionItem | null; onClose: () => void }) {
  const create = useCreateAuctionItem(auctionId);
  const update = useUpdateAuctionItem(auctionId, item?.id ?? "");
  const categories = useCategories();
  const form = useForm({
    resolver: zodResolver(CreateAuctionItemRequest),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? undefined,
      quantity: item?.quantity ?? 1,
      unit: item?.unit ?? undefined,
      condition: (item?.condition as (typeof ITEM_CONDITIONS)[number] | undefined) ?? undefined,
      estimatedValue: item?.estimatedValue ?? undefined,
      categoryId: item?.categoryId ?? undefined,
      region: item?.region ?? undefined,
      city: item?.city ?? undefined,
    },
  });
  const pending = create.isPending || update.isPending;
  const t = useT("workspace");
  const tc = useT("common");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("lots.editTitle") : t("lots.addTitle")}</DialogTitle>
          <DialogDescription>{t("lots.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => {
              const clean = Object.fromEntries(
                Object.entries(values).filter(([, value]) => value !== "" && value !== undefined),
              ) as typeof values;
              const done = {
                onSuccess: () => {
                  toast.success(item ? t("lots.updated") : t("lots.added"));
                  onClose();
                },
                onError: (error: unknown) => {
                  if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
                },
              };
              if (item) update.mutate(clean, done);
              else create.mutate(clean, done);
            })}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t("lots.title")}</FormLabel>
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
                  <FormLabel>{t("lots.description")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.quantity")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.unit")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("lots.unitPlaceholder")} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.condition")}</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("lots.choose")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ITEM_CONDITIONS.map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          {enumLabel(condition)}
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
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.estimatedValue", { currency: tc("currency") })}</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.category")}</FormLabel>
                  <Select
                    value={field.value ?? NO_CATEGORY}
                    onValueChange={(value) => field.onChange(value === NO_CATEGORY ? undefined : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>{t("lots.notSet")}</SelectItem>
                      {(categories.data?.items ?? []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
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
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lots.region")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? t("lots.saving") : t("lots.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
