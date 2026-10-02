import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/auth-provider";
import { useSwitchOrgMutation } from "@/features/auth/queries";
import { toast } from "sonner";
import { useT } from "@/i18n/context";

export function OrgSwitcher() {
  const { session } = useAuth();
  const mutation = useSwitchOrgMutation();
  const t = useT("layout");
  const orgs = session?.organizations ?? [];
  if (orgs.length === 0) return null;

  const current = orgs.find((org) => org.organizationId === session?.organizationId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56 justify-start">
          <Building2 className="size-4" />
          <span className="truncate">{current?.organizationName ?? t("org.select")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("org.context")}</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.organizationId}
            disabled={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync(org.organizationId);
                toast.success(t("org.switched", { name: org.organizationName }));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("org.switchFailed"));
              }
            }}
          >
            {org.organizationName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
