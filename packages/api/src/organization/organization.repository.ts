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

export async function findBySlug(slug: string): Promise<Organization | null> {
  const row = await queryOne<DbOrg>("SELECT * FROM organizations WHERE slug = $1", [slug]);
  return row ? mapOrg(row) : null;
}

export async function updateOrganization(id: string, input: Partial<{
  name: string;
  slug: string;
  orgType: OrgType;
  taxpayerId: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
}>): Promise<Organization | null> {
  const assignments: { field: string; value: unknown }[] = [];
  if (input.name !== undefined) assignments.push({ field: "name", value: input.name });
  if (input.slug !== undefined) assignments.push({ field: "slug", value: input.slug });
  if (input.orgType !== undefined) assignments.push({ field: "org_type", value: input.orgType });
  if (input.taxpayerId !== undefined) assignments.push({ field: "taxpayer_id", value: input.taxpayerId });
  if (input.region !== undefined) assignments.push({ field: "region", value: input.region });
  if (input.contactEmail !== undefined) assignments.push({ field: "contact_email", value: input.contactEmail });
  if (input.contactPhone !== undefined) assignments.push({ field: "contact_phone", value: input.contactPhone });
  if (input.isActive !== undefined) assignments.push({ field: "is_active", value: input.isActive });
  if (assignments.length === 0) return findById(id);

  const columns = assignments.map((assignment, index) => `${assignment.field} = $${index + 2}`);
  const values: unknown[] = [id, ...assignments.map((assignment) => assignment.value)];
  const row = await queryOne<DbOrg>(
    `UPDATE organizations SET ${columns.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values,
  );
  return row ? mapOrg(row) : null;
}

export async function hasOperationalDependencies(id: string): Promise<boolean> {
  const [auction, source, pending] = await Promise.all([
    queryOne<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM auctions WHERE org_id = $1) AS exists", [id]),
    queryOne<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM autofetch_sources WHERE organization_id = $1) AS exists", [id]),
    queryOne<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM autofetch_pending_items WHERE organization_id = $1) AS exists", [id]),
  ]);
  return Boolean(auction?.exists || source?.exists || pending?.exists);
}

export async function deleteOrganization(id: string): Promise<void> {
  await query(`DELETE FROM organizations WHERE id = $1`, [id]);
}

export interface OrganizationMemberRow {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export async function listMembers(organizationId: string): Promise<OrganizationMemberRow[]> {
  const rows = await queryAll<{
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: Date;
  }>(
    `SELECT om.user_id, p.email, p.full_name, om.role, om.created_at
       FROM organization_members om
       JOIN profiles p ON p.id = om.user_id
      WHERE om.organization_id = $1
      ORDER BY om.created_at ASC`,
    [organizationId],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  }));
}

/**
 * Adds or re-roles a member. The primary key is (organization_id, user_id),
 * so an upsert is the natural way to express "grant this person this role",
 * and makes the endpoint idempotent.
 */
export async function upsertMember(input: {
  organizationId: string;
  userId: string;
  role: string;
}): Promise<OrganizationMemberRow | null> {
  await query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [input.organizationId, input.userId, input.role],
  );
  const members = await listMembers(input.organizationId);
  return members.find((member) => member.userId === input.userId) ?? null;
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
}

export async function countAdmins(organizationId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM organization_members
      WHERE organization_id = $1 AND role IN ('org_admin', 'organization_admin')`,
    [organizationId],
  );
  return Number(row?.count ?? 0);
}
