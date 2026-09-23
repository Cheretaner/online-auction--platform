import { useMyDeposits } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function DepositsPage() {
  const query = useMyDeposits();
  return (
    <ResourcePage
      title="Deposits"
      description="Track bid security deposits associated with your account."
      query={query}
    />
  );
}
