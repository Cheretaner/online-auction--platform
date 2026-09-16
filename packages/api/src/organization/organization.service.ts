import * as repo from "./organization.repository.js";
import type { Organization } from "./organization.types.js";

export async function createOrganization(name: string, slug: string): Promise<Organization> {
  return repo.createOrganization(name, slug);
}

export async function listOrganizations(): Promise<Organization[]> {
  return repo.listOrganizations();
}
