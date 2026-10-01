import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/feedback/query-state";
import { useAuth } from "@/features/auth/auth-provider";
export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  return (
    <div>
      <PageHeader
        title="Profile"
        description="The details registered on your account."
      />
      {user ? (
        <Card>
          <CardContent className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
            {[
              ["Name", user.fullName],
              ["Email", user.email],
              ["Phone", user.phone],
              ["Account type", user.accountType],
              ["Region", user.region],
              ["Verification", user.verificationStatus],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="eyebrow text-muted-foreground">{label}</p>
                <p className={`mt-1 font-medium first-letter:uppercase ${value ? "" : "text-muted-foreground"}`}>
                  {value || "Not provided"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <PageSkeleton rows={2} />
      )}
    </div>
  );
}
