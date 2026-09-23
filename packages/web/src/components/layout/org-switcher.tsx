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

export function OrgSwitcher() {
  const { session } = useAuth();
  const mutation = useSwitchOrgMutation();
  const orgs = session?.organizations ?? [];
  if (orgs.length === 0) return null;

  const current = orgs.find((org) => org.organizationId === session?.organizationId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-48 justify-start">
          <Building2 className="size-4" />
          <span className="truncate">{current?.organizationName ?? "Select organization"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Organization context</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.organizationId}
            disabled={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync(org.organizationId);
                toast.success(`Switched to ${org.organizationName}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not switch organization");
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
