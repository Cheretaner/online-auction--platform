import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutofetchStats } from "@/features/operations/queries";
import { Database, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

export function AutofetchStatsCards() {
  const { data: stats, isLoading } = useAutofetchStats();

  if (isLoading || !stats) {
    return null; // or loading skeleton
  }

  const { total = 0, bySeverity = {}, avgConfidenceScore = 0 } = stats as any;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground">Processed by AutoFetch</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Conflicts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{bySeverity.HIGH || 0}</div>
          <p className="text-xs text-muted-foreground">Require immediate attention</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low/Medium Conflicts</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(bySeverity.LOW || 0) + (bySeverity.MEDIUM || 0)}</div>
          <p className="text-xs text-muted-foreground">Minor duplicates or warnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg AI Confidence</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(avgConfidenceScore * 100).toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Categorization accuracy</p>
        </CardContent>
      </Card>
    </div>
  );
}
