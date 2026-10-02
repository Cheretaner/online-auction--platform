import { useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  useAutofetchPending, 
  useApproveAutofetchItem, 
  useRejectAutofetchItem 
} from "@/features/operations/queries";
import { useOrgAuctions } from "@/features/auctions/queries";
import { useAuth } from "@/features/auth/auth-provider";
import { getErrorMessage } from "@/lib/api/errors";

export function AutofetchPendingTab() {
  const { session } = useAuth();
  const { data: pending, isLoading } = useAutofetchPending();
  const { data: auctions } = useOrgAuctions(session?.organizationId || undefined);
  
  const approveMutation = useApproveAutofetchItem();
  const rejectMutation = useRejectAutofetchItem();

  const [approveDialog, setApproveDialog] = useState<{ open: boolean; itemId: string | null }>({
    open: false,
    itemId: null,
  });
  const [selectedAuction, setSelectedAuction] = useState<string>("");

  const handleApprove = () => {
    if (!approveDialog.itemId || !selectedAuction) return;
    
    approveMutation.mutate(
      { id: approveDialog.itemId, auctionId: selectedAuction },
      {
        onSuccess: () => {
          toast.success("Item approved and published to auction");
          setApproveDialog({ open: false, itemId: null });
          setSelectedAuction("");
        },
        onError: (err) => {
          toast.error(getErrorMessage(err));
        },
      }
    );
  };

  const handleReject = (id: string) => {
    if (confirm("Are you sure you want to reject this imported item?")) {
      rejectMutation.mutate(
        { id, reason: "Manual rejection" },
        {
          onSuccess: () => toast.success("Item rejected"),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      );
    }
  };

  const items = pending?.items || [];
  const draftAuctions = (auctions?.items || []).filter((a: any) => a.status === "draft");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Pending Imports</h2>
          <p className="text-sm text-muted-foreground">Review items fetched from external sources before publishing them.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading queue...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending items awaiting review.</p>
        )}
        
        {items.map((item: any) => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>
                {item.conflictScore > 0 && (
                  <Badge variant="destructive" className="shrink-0 flex items-center">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Conflict
                  </Badge>
                )}
              </div>
              <CardDescription className="uppercase text-xs">{item.externalSource}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-2 mb-4">
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2" title={item.description}>
                    {item.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                  <div>
                    <span className="font-semibold block text-xs uppercase text-muted-foreground">Category</span>
                    <span className="truncate">{item.categoryName || "Auto"}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-xs uppercase text-muted-foreground">Est. Value</span>
                    <span className="truncate">{item.estimatedValue ? `$${item.estimatedValue}` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-xs uppercase text-muted-foreground">AI Confidence</span>
                    <span className="truncate">
                      {Number.isFinite(Number(item.confidenceScore))
                        ? `${Number(item.confidenceScore).toFixed(0)}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-auto">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleReject(item.id)}
                  disabled={rejectMutation.isPending}
                >
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => setApproveDialog({ open: true, itemId: item.id })}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog 
        open={approveDialog.open} 
        onOpenChange={(open) => !open && setApproveDialog({ open: false, itemId: null })}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve to Auction</DialogTitle>
            <DialogDescription>
              Select a Draft auction to attach this item to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAuction} onValueChange={setSelectedAuction}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Draft Auction" />
              </SelectTrigger>
              <SelectContent>
                {draftAuctions.length === 0 && (
                  <SelectItem value="none" disabled>No draft auctions available</SelectItem>
                )}
                {draftAuctions.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, itemId: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={!selectedAuction || approveMutation.isPending}
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
