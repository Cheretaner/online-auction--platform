import { query } from "../infrastructure/database/query.js";
import type { Organization } from "./organization.types.js";

interface DbOrg {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
}

function mapOrg(row: DbOrg): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createOrganization(name: string, slug: string): Promise<Organization> {
  const result = await query<DbOrg>(
    "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *",
    [name, slug],
  );
  return mapOrg(result.rows[0]);
}

export async function listOrganizations(): Promise<Organization[]> {
  const result = await query<DbOrg>("SELECT * FROM organizations ORDER BY created_at DESC");
  return result.rows.map(mapOrg);
}
