import {
  useAutofetchPending,
  useAutofetchSources,
  useAutofetchStats,
} from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { Card, CardContent } from "@/components/ui/card";
export default function AutofetchPage() {
  const sources = useAutofetchSources();
  const pending = useAutofetchPending();
  const stats = useAutofetchStats();
  return (
    <div className="space-y-8">
      <ResourcePage
        title="Autofetch sources"
        description="Configured data sources returned by the API."
        query={sources}
      />
      <ResourcePage
        title="Pending imports"
        description="Items awaiting an authorized operator review."
        query={pending}
      />
      <Card>
        <CardContent className="p-4">
          <h2 className="font-medium">Import statistics</h2>
          <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
            {stats.data
              ? JSON.stringify(stats.data, null, 2)
              : stats.isError
                ? "Statistics unavailable"
                : "Loading statistics…"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
