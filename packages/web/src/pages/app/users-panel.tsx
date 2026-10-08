import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateUserRequest, ROLES, UpdateUserRequest } from "@auction/shared";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import type { AdminUserRecord } from "@/lib/api/types";
import { enumLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

export function UsersPanel() {
  const users = useUsers();
  const t = useT("tools");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orgs.userManagement")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("orgs.userManagementDescription")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <UserCreator />
        {users.isLoading ? <PageSkeleton rows={2} /> : null}
        {users.isError ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : null}
        {!users.isLoading && !users.isError && (users.data?.items.length ?? 0) === 0 ? (
          <EmptyState size="inline" icon={Plus} title={t("orgs.noUsers")} />
        ) : null}
        <div className="divide-y rounded-md border">
          {(users.data?.items ?? []).map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{user.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.roles.map((role) => <Badge key={role} variant="muted" className="capitalize">{enumLabel(role)}</Badge>)}
                </div>
              </div>
              <div className="flex gap-2">
                <UserEditor user={user} />
                <DeactivateUser user={user} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UserCreator() {
  const create = useCreateUser();
  const t = useT("tools");
  const form = useForm({ resolver: zodResolver(CreateUserRequest), defaultValues: { email: "", password: "", fullName: "", platformRole: "bidder", isActive: true } });
  return (
    <Form {...form}>
      <form className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => create.mutate(values, {
        onSuccess: () => { toast.success(t("orgs.createdUser")); form.reset({ email: "", password: "", fullName: "", platformRole: "bidder", isActive: true }); },
        onError: (error) => { if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error)); },
      }))}>
        <UserField form={form} name="fullName" label={t("orgs.fullName")} />
        <UserField form={form} name="email" label={t("orgs.email")} type="email" />
        <UserField form={form} name="password" label={t("orgs.password")} type="password" />
        <UserRoleField form={form} />
        <Button type="submit" className="sm:col-span-2" loading={create.isPending}><Plus aria-hidden /> {t("orgs.createUser")}</Button>
      </form>
    </Form>
  );
}

function UserField({ form, name, label, type = "text" }: { form: UseFormReturn<FieldValues>; name: "fullName" | "email" | "password"; label: string; type?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type={type} {...field} /></FormControl><FormMessage /></FormItem>} />;
}

function UserRoleField({ form }: { form: UseFormReturn<FieldValues> }) {
  const t = useT("tools");
  return <FormField control={form.control} name="platformRole" render={({ field }) => <FormItem><FormLabel>{t("orgs.platformRole")}</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{ROLES.map((role) => <SelectItem key={role} value={role}>{enumLabel(role)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />;
}

function UserEditor({ user }: { user: AdminUserRecord }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateUser();
  const t = useT("tools");
  const form = useForm({ resolver: zodResolver(UpdateUserRequest), defaultValues: { fullName: user.fullName, platformRole: user.platformRole, isActive: user.isActive } });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil aria-hidden /> {t("orgs.editUser")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("orgs.editUser")}</DialogTitle><DialogDescription>{user.email}</DialogDescription></DialogHeader>
          <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => update.mutate({ id: user.id, body: values }, {
            onSuccess: () => { toast.success(t("orgs.updatedUser")); setOpen(false); },
            onError: (error) => { if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error)); },
          }))}>
            <UserField form={form} name="fullName" label={t("orgs.fullName")} />
            <UserRoleField form={form} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("orgs.cancel")}</Button><Button type="submit" loading={update.isPending}>{t("orgs.save")}</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeactivateUser({ user }: { user: AdminUserRecord }) {
  const [open, setOpen] = useState(false);
  const deactivate = useDeactivateUser();
  const t = useT("tools");
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}><Trash2 aria-hidden /> {t("orgs.deactivateUser", { name: user.fullName })}</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={t("orgs.deactivateTitle")} description={t("orgs.deactivateDescription", { name: user.fullName })} confirmLabel={t("orgs.deactivateUser", { name: user.fullName })} destructive pending={deactivate.isPending} onConfirm={() => deactivate.mutate(user.id, { onSuccess: () => { toast.success(t("orgs.deactivated")); setOpen(false); }, onError: (error) => toast.error(getErrorMessage(error)) })} />
    </>
  );
}
