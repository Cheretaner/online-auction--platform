import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  return (
    <div>
      <PageHeader
        title="Profile"
        description="Account information associated with your authenticated session."
      />
      {user ? (
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            {[
              ["Name", user.fullName],
              ["Email", user.email],
              ["Phone", user.phone],
              ["Account type", user.accountType],
              ["Region", user.region],
              ["Verification", user.verificationStatus],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-medium">{value || "Not provided"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p role="status">Loading account…</p>
      )}
    </div>
  );
}
