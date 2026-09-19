import type { CreateOrganizationRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import * as repo from "./organization.repository.js";
import type { Organization } from "./organization.types.js";

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createOrganization(
  input: CreateOrganizationRequest,
  onboardedBy: string,
): Promise<Organization> {
  return withTransaction(async () => {
    const existing = await repo.findByTaxpayerId(input.tinNumber);
    if (existing) {
      throw AppError.conflict("An organization with this TIN already exists");
    }

    const slug = generateSlug(input.name);

    return repo.createOrganization({
      name: input.name,
      slug,
      orgType: input.orgType,
      taxpayerId: input.tinNumber,
      region: input.region,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      onboardedBy,
    });
  }, { userId: onboardedBy });
}

export async function getOrganization(id: string): Promise<Organization> {
  const org = await repo.findById(id);
  if (!org) throw AppError.notFound("Organization not found");
  return org;
}

export async function listOrganizations(): Promise<Organization[]> {
  return repo.listOrganizations();
}
