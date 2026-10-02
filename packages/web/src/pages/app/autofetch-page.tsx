import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { AutofetchSourcesTab } from "@/features/operations/components/autofetch-sources-tab";
import { AutofetchPendingTab } from "@/features/operations/components/autofetch-pending-tab";
import { AutofetchStatsCards } from "@/features/operations/components/autofetch-stats-cards";

export default function AutofetchPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="AutoFetch Operations" 
        description="Manage automated data ingestion and review imported auction items." 
      />
      
      <AutofetchStatsCards />

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="pending">Review Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="sources" className="space-y-4 border-none p-0 outline-none">
          <AutofetchSourcesTab />
        </TabsContent>
        <TabsContent value="pending" className="space-y-4 border-none p-0 outline-none">
          <AutofetchPendingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
