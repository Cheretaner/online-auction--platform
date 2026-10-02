import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/feedback/query-state";
import { useAuth } from "@/features/auth/auth-provider";
import { useT } from "@/i18n/context";
import { regionLabel, statusLabel } from "@/lib/format";
export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  const t = useT("account");
  const tc = useT("common");
  return (
    <div>
      <PageHeader
        title={t("profile.title")}
        description={t("profile.description")}
      />
      {user ? (
        <Card>
          <CardContent className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
            {[
              [t("profile.name"), user.fullName],
              [t("profile.email"), user.email],
              [t("profile.phone"), user.phone],
              [t("profile.accountType"), user.accountType ? statusLabel(user.accountType) : null],
              [t("profile.region"), regionLabel(user.region)],
              [t("profile.verification"), user.verificationStatus ? statusLabel(user.verificationStatus) : null],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="eyebrow text-muted-foreground">{label}</p>
                <p className={`mt-1 font-medium first-letter:uppercase ${value ? "" : "text-muted-foreground"}`}>
                  {value || tc("notProvided")}
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
