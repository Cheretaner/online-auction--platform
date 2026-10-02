import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateOrganizationRequest, ORG_TYPES } from "@auction/shared";
import { Building2, ChevronDown, Trash2, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/feedback/query-state";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { QueryState } from "@/components/feedback/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import {
  useAddOrgMember,
  useCreateOrganization,
  useOrganizations,
  useOrgMembers,
  useRemoveOrgMember,
} from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { OrganizationRecord } from "@/lib/api/types";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { enumLabel, hasRole, regionLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

const MEMBER_ROLES = ["auction_officer", "compliance_officer", "org_admin"] as const;

export default function OrganizationsPage() {
  const { roles, session } = useAuth();
  const superAdmin = hasRole(roles, "super_admin");
  const t = useT("tools");
  const orgs = useOrganizations();
  // Org admins manage their own organization only; the API enforces it.
  const visible = (orgs.data?.items ?? []).filter(
    (org) => superAdmin || session?.organizations.some((m) => m.organizationId === org.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("orgs.title")}
        description={
          superAdmin
            ? t("orgs.superDescription")
            : t("orgs.adminDescription")
        }
      />
      {superAdmin ? <CreateOrganizationCard /> : null}
      <QueryState
        isLoading={orgs.isLoading}
        isError={orgs.isError}
        error={orgs.error}
        isEmpty={visible.length === 0}
        emptyIcon={Building2}
        emptyTitle={t("orgs.empty")}
        onRetry={() => void orgs.refetch()}
      >
        <div className="space-y-4">
          {visible.map((org) => (
            <OrganizationCard key={org.id} org={org} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function CreateOrganizationCard() {
  const create = useCreateOrganization();
  const t = useT("tools");
  const form = useForm({
    resolver: zodResolver(CreateOrganizationRequest),
    defaultValues: {
      name: "",
      orgType: "government" as const,
      tinNumber: "",
      region: "",
      contactEmail: "",
      contactPhone: "",
    },
  });
  const text = (name: "name" | "tinNumber" | "region" | "contactEmail" | "contactPhone", label: string, type = "text") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orgs.onboard")}</CardTitle>
        <CardDescription>{t("orgs.onboardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              create.mutate(values, {
                onSuccess: () => {
                  toast.success(t("orgs.created"));
                  form.reset();
                },
                onError: (error) => {
                  if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
                },
              }),
            )}
          >
            {text("name", t("orgs.name"))}
            <FormField
              control={form.control}
              name="orgType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orgs.type")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORG_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {enumLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {text("tinNumber", t("orgs.tin"))}
            {text("region", t("orgs.region"))}
            {text("contactEmail", t("orgs.contactEmail"), "email")}
            {text("contactPhone", t("orgs.contactPhone"), "tel")}
            <div className="sm:col-span-2">
              <Button type="submit" loading={create.isPending}>
                {create.isPending ? t("orgs.creating") : t("orgs.create")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function OrganizationCard({ org }: { org: OrganizationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const t = useT("tools");
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold">{org.name}</p>
              <Badge variant="secondary" className="capitalize">
                {enumLabel(org.orgType)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {regionLabel(org.region)} · {t("orgs.tin")} <span className="font-mono">{org.taxpayerId}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {org.contactEmail} · {org.contactPhone}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? t("orgs.hideMembers") : t("orgs.manageMembers")}
            <ChevronDown className={expanded ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
          </Button>
        </div>
        {expanded ? <Members orgId={org.id} /> : null}
      </CardContent>
    </Card>
  );
}

function Members({ orgId }: { orgId: string }) {
  const members = useOrgMembers(orgId);
  const add = useAddOrgMember(orgId);
  const remove = useRemoveOrgMember(orgId);
  const id = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof MEMBER_ROLES)[number]>("auction_officer");
  const t = useT("tools");
  const [removing, setRemoving] = useState<{ userId: string; label: string } | null>(null);

  return (
    <div className="space-y-4 border-t pt-4">
      {members.isLoading ? <PageSkeleton rows={2} /> : null}
      <ul className="divide-y rounded-md border">
        {(members.data?.items ?? []).map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback>{(member.fullName ?? member.email ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate font-medium">{member.fullName ?? member.email ?? member.userId}</span>
                <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Badge variant="muted" className="hidden capitalize sm:inline-flex">
                {enumLabel(member.role)}
              </Badge>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              aria-label={t("orgs.remove", { name: member.fullName ?? member.email ?? t("orgs.member") })}
              onClick={() => setRemoving({ userId: member.userId, label: member.fullName ?? member.email ?? member.userId })}
            >
              <Trash2 />
            </Button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-[1fr_200px_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(
            { email: email.trim(), role },
            {
              onSuccess: () => {
                toast.success(t("orgs.memberAdded"));
                setEmail("");
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>{t("orgs.memberEmail")}</Label>
          <Input id={`${id}-email`} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-role`}>{t("orgs.role")}</Label>
          <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
            <SelectTrigger id={`${id}-role`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {enumLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" loading={add.isPending}>
          {add.isPending ? null : <UserPlus aria-hidden />} {t("orgs.addMember")}
        </Button>
      </form>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("orgs.removeTitle")}
        description={t("orgs.removeDescription", { name: removing?.label ?? "" })}
        confirmLabel={t("orgs.removeTitle")}
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.userId, {
            onSuccess: () => {
              toast.success(t("orgs.removed"));
              setRemoving(null);
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />
    </div>
  );
}
