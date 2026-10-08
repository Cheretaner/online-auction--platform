import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateOrganizationRequest } from "@auction/shared";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateOrganization } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import type { OrganizationRecord } from "@/lib/api/types";
import { enumLabel, regionLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

export function OrganizationEditor({
  open,
  organization,
  onOpenChange,
}: {
  open: boolean;
  organization: OrganizationRecord;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateOrganization();
  const t = useT("tools");
  const form = useForm({
    resolver: zodResolver(UpdateOrganizationRequest),
    defaultValues: {
      name: organization.name,
      orgType: organization.orgType,
      tinNumber: organization.taxpayerId,
      region: organization.region,
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: organization.name,
        orgType: organization.orgType,
        tinNumber: organization.taxpayerId,
        region: organization.region,
        contactEmail: organization.contactEmail,
        contactPhone: organization.contactPhone,
      });
    }
  }, [open, organization, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orgs.edit")}</DialogTitle>
          <DialogDescription>{regionLabel(organization.region)} · {organization.taxpayerId}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => update.mutate({ id: organization.id, body: values }, {
            onSuccess: () => {
              toast.success(t("orgs.updated"));
              onOpenChange(false);
            },
            onError: (error) => {
              if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
            },
          }))}>
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>{t("orgs.name")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="tinNumber" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{t("orgs.tin")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="contactEmail" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{t("orgs.contactEmail")}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="region" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{t("orgs.region")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="contactPhone" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{t("orgs.contactPhone")}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{enumLabel(organization.orgType)}</Badge>
              <span>{t("orgs.type")}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("orgs.cancel")}</Button>
              <Button type="submit" loading={update.isPending}>{t("orgs.save")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
