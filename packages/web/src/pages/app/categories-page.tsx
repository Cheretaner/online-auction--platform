import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateCategoryRequest } from "@auction/shared";
import type { z } from "zod";
import { Pencil, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { useCategories, useCreateCategory, useUpdateCategory } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import type { CategoryRecord } from "@/lib/api/types";
import { useT } from "@/i18n/context";

const NO_PARENT = "none";
type CategoryFormValues = z.input<typeof CreateCategoryRequest>;

export default function CategoriesPage() {
  const query = useCategories();
  const { roles } = useAuth();
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const t = useT("account");
  const categories = query.data?.items ?? [];
  const canManage = roles.includes("super_admin");

  return (
    <div className="">
      <PageHeader
        title={t("lists.categoriesTitle")}
        description={t("lists.categoriesDescription")}
      />
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("lists.createCategory")}</CardTitle>
            <CardDescription>{t("lists.categoryEditorDescription")}</CardDescription>
          </CardHeader>
          <CardContent><CategoryEditor categories={categories} /></CardContent>
        </Card>
      ) : null}
      {query.isLoading ? (
        <PageSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tags} title={t("lists.categoriesEmpty")} />
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => {
            const parent = categories.find((item) => item.id === category.parentId);
            return (
              <li key={category.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-semibold">{category.name}</h2>
                      <p className="font-mono text-xs text-muted-foreground">{category.slug}</p>
                      {parent ? <p className="text-xs text-muted-foreground">{t("lists.categoryParent", { name: parent.name })}</p> : null}
                      {category.description ? <p className="text-sm text-muted-foreground">{category.description}</p> : null}
                    </div>
                    {canManage ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(category)}>
                        <Pencil aria-hidden /> {t("lists.editCategory")}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("lists.editCategory")}</DialogTitle>
              <DialogDescription>{t("lists.categoryEditorDescription")}</DialogDescription>
            </DialogHeader>
            <CategoryEditor
              key={editing.id}
              category={editing}
              categories={categories}
              onSaved={() => setEditing(null)}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function CategoryEditor({
  category,
  categories,
  onSaved,
}: {
  category?: CategoryRecord;
  categories: CategoryRecord[];
  onSaved?: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? "");
  const t = useT("account");
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(CreateCategoryRequest),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parentId: category?.parentId,
      description: category?.description ?? "",
    },
  });
  const pending = create.isPending || update.isPending;
  const excludedParentIds = new Set<string>();
  if (category) {
    excludedParentIds.add(category.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of categories) {
        if (item.parentId && excludedParentIds.has(item.parentId) && !excludedParentIds.has(item.id)) {
          excludedParentIds.add(item.id);
          changed = true;
        }
      }
    }
  }

  async function submit(values: CategoryFormValues) {
    const body = {
      ...values,
      parentId: values.parentId,
      description: values.description?.trim() || undefined,
    };
    try {
      if (category) {
        await update.mutateAsync(body);
        toast.success(t("lists.categoryUpdated"));
      } else {
        await create.mutateAsync(body);
        toast.success(t("lists.categoryCreated"));
        form.reset();
      }
      onSaved?.();
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
    }
  }

  return (
    <Form {...form}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lists.categoryName")}</FormLabel>
                  <FormControl><Input maxLength={100} disabled={pending} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lists.categorySlug")}</FormLabel>
                  <FormControl><Input maxLength={100} autoCapitalize="none" disabled={pending} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lists.categoryParentLabel")}</FormLabel>
                  <Select
                    value={field.value ?? NO_PARENT}
                    onValueChange={(value) => field.onChange(value === NO_PARENT ? null : value)}
                    disabled={pending}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>{t("lists.noCategoryParent")}</SelectItem>
                      {categories.filter((item) => !excludedParentIds.has(item.id)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t("lists.categoryDescription")}</FormLabel>
                  <FormControl><Textarea maxLength={500} rows={3} disabled={pending} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending} disabled={pending}>
                {category ? t("lists.saveCategory") : t("lists.createCategory")}
              </Button>
            </div>
      </form>
    </Form>
  );
}
