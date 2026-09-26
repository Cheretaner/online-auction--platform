import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateOrganizationRequest, ORG_TYPES } from "@auction/shared";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { QueryState } from "@/components/feedback/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { hasRole } from "@/lib/format";

const MEMBER_ROLES = [
  { value: "auction_officer", label: "Auction officer" },
  { value: "compliance_officer", label: "Compliance officer" },
  { value: "org_admin", label: "Organization admin" },
] as const;

export default function OrganizationsPage() {
  const { roles, session } = useAuth();
  const superAdmin = hasRole(roles, "super_admin");
  const orgs = useOrganizations();
  // Org admins manage their own organization only; the API enforces it.
  const visible = (orgs.data?.items ?? []).filter(
    (org) => superAdmin || session?.organizations.some((m) => m.organizationId === org.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description={
          superAdmin
            ? "Onboard institutions and give their staff officer roles."
            : "Manage who can act for your organization."
        }
      />
      {superAdmin ? <CreateOrganizationCard /> : null}
      <QueryState
        isLoading={orgs.isLoading}
        isError={orgs.isError}
        error={orgs.error}
        isEmpty={visible.length === 0}
        emptyTitle="No organizations"
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
        <CardTitle className="text-lg">Onboard an organization</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              create.mutate(values, {
                onSuccess: () => {
                  toast.success("Organization created");
                  form.reset();
                },
                onError: (error) => {
                  if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
                },
              }),
            )}
          >
            {text("name", "Name")}
            <FormField
              control={form.control}
              name="orgType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORG_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {text("tinNumber", "TIN")}
            {text("region", "Region")}
            {text("contactEmail", "Contact email", "email")}
            {text("contactPhone", "Contact phone", "tel")}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create organization"}
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
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{org.name}</p>
            <p className="text-sm text-muted-foreground">
              {org.orgType.replaceAll("_", " ")} · {org.region} · TIN {org.taxpayerId}
            </p>
            <p className="text-xs text-muted-foreground">
              {org.contactEmail} · {org.contactPhone}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Hide members" : "Manage members"}
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
  const [role, setRole] = useState<(typeof MEMBER_ROLES)[number]["value"]>("auction_officer");
  const [removing, setRemoving] = useState<{ userId: string; label: string } | null>(null);

  return (
    <div className="space-y-3 border-t pt-3">
      {members.isLoading ? <p className="text-sm text-muted-foreground">Loading members…</p> : null}
      <ul className="space-y-2">
        {(members.data?.items ?? []).map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{member.fullName ?? member.email ?? member.userId}</span>{" "}
              <span className="text-muted-foreground">
                {member.email} · {member.role.replaceAll("_", " ")}
              </span>
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove ${member.fullName ?? member.email ?? "member"}`}
              onClick={() => setRemoving({ userId: member.userId, label: member.fullName ?? member.email ?? member.userId })}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_200px_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(
            { email: email.trim(), role },
            {
              onSuccess: () => {
                toast.success("Member added. They must sign in again to get the new role.");
                setEmail("");
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>Email of a registered user</Label>
          <Input id={`${id}-email`} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
            <SelectTrigger aria-label="Member role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_ROLES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={add.isPending}>
          <UserPlus className="size-4" aria-hidden /> Add
        </Button>
      </form>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member"
        description={`${removing?.label ?? ""} will lose their role in this organization.`}
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.userId, {
            onSuccess: () => {
              toast.success("Member removed");
              setRemoving(null);
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />
    </div>
  );
}
