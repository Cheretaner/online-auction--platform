import type { OrgType } from "@auction/shared";
import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import type { Organization } from "./organization.types.js";

interface DbOrg {
  id: string;
  name: string;
  slug: string;
  org_type: OrgType;
  taxpayer_id: string;
  region: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  onboarded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapOrg(row: DbOrg): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgType: row.org_type,
    taxpayerId: row.taxpayer_id,
    region: row.region,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    logoUrl: row.logo_url,
    isActive: row.is_active,
    onboardedBy: row.onboarded_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  orgType: OrgType;
  taxpayerId: string;
  region?: string;
  contactEmail?: string;
  contactPhone?: string;
  onboardedBy?: string;
}): Promise<Organization> {
  const result = await query<DbOrg>(
    `INSERT INTO organizations (name, slug, org_type, taxpayer_id, region, contact_email, contact_phone, onboarded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [input.name, input.slug, input.orgType, input.taxpayerId, input.region ?? null, input.contactEmail ?? null, input.contactPhone ?? null, input.onboardedBy ?? null],
  );
  return mapOrg(result.rows[0]);
}

export async function findById(id: string): Promise<Organization | null> {
  const row = await queryOne<DbOrg>("SELECT * FROM organizations WHERE id = $1", [id]);
  return row ? mapOrg(row) : null;
}

export async function findByTaxpayerId(taxpayerId: string): Promise<Organization | null> {
  const row = await queryOne<DbOrg>("SELECT * FROM organizations WHERE taxpayer_id = $1", [taxpayerId]);
  return row ? mapOrg(row) : null;
}

export async function listOrganizations(): Promise<Organization[]> {
  const rows = await queryAll<DbOrg>("SELECT * FROM organizations ORDER BY created_at DESC");
  return rows.map(mapOrg);
}
