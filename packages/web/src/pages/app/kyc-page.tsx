import { useMyVerification } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function KycPage() {
  const query = useMyVerification();
  return (
    <ResourcePage
      title="Identity verification"
      description="Review the verification status returned for your account."
      query={query}
    />
  );
}
