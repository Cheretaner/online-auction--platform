import type { AddOrganizationMemberRequest, CreateOrganizationRequest, Role } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { isUniqueViolation } from "../kernel/pg.js";
import * as audit from "../audit/audit.service.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./organization.repository.js";
import type { Organization } from "./organization.types.js";

const identityRepo = new IdentityRepository();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Appends a numeric suffix until the slug is free. */
async function uniqueSlug(name: string): Promise<string> {
  const base = generateSlug(name) || "organization";
  let candidate = base;
  let suffix = 1;
  while (await repo.findBySlug(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export async function createOrganization(
  input: CreateOrganizationRequest,
  actor: { userId: string; roles: Role[] },
): Promise<Organization> {
  return withTransaction(
    async () => {
      const existing = await repo.findByTaxpayerId(input.tinNumber);
      if (existing) {
        throw AppError.conflict("An organization with this TIN already exists");
      }

      const slug = await uniqueSlug(input.name);

      let organization: Organization;
      try {
        organization = await repo.createOrganization({
          name: input.name,
          slug,
          orgType: input.orgType,
          taxpayerId: input.tinNumber,
          region: input.region,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          onboardedBy: actor.userId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw AppError.conflict("An organization with this TIN or name already exists");
        }
        throw error;
      }

      // The creator becomes the first org_admin. Without this there is no
      // member who can grant roles, so the organization would be unusable.
      await repo.upsertMember({
        organizationId: organization.id,
        userId: actor.userId,
        role: "org_admin",
      });

      await audit.appendAuditEvent({
        auctionId: null,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "organization",
        entityId: organization.id,
        action: "organization.created",
        payload: { name: organization.name, orgType: organization.orgType, slug },
      });

      return organization;
    },
    { userId: actor.userId },
  );
}

export async function getOrganization(id: string): Promise<Organization> {
  const org = await repo.findById(id);
  if (!org) throw AppError.notFound("Organization not found");
  return org;
}

export async function listOrganizations(): Promise<Organization[]> {
  return repo.listOrganizations();
}

export async function listMembers(organizationId: string) {
  await getOrganization(organizationId);
  return repo.listMembers(organizationId);
}

export async function addMember(
  organizationId: string,
  input: AddOrganizationMemberRequest,
  actor: { userId: string; roles: Role[] },
) {
  return withTransaction(
    async () => {
      await getOrganization(organizationId);

      // Accept either a user id or an email so an admin can onboard a
      // colleague without first looking up their internal id.
      const profile = input.userId
        ? await identityRepo.findProfileById(input.userId)
        : await identityRepo.findProfileByEmail(input.email!);

      if (!profile) {
        throw AppError.notFound("No active account matches that user");
      }

      // super_admin is a platform role, not an organization membership, so
      // it is rejected here rather than silently violating the CHECK.
      if (input.role === "super_admin") {
        throw AppError.badRequest(
          "super_admin is a platform role and cannot be granted as an organization membership",
        );
      }

      const member = await repo.upsertMember({
        organizationId,
        userId: profile.id,
        role: input.role,
      });

      await audit.appendAuditEvent({
        auctionId: null,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "organization_member",
        entityId: profile.id,
        action: "organization.member_granted",
        payload: { organizationId, role: input.role, subjectUserId: profile.id },
      });

      await notifications.enqueueNotification({
        userId: profile.id,
        channel: "in_app",
        type: "organization.member_granted",
        title: "You joined an organization",
        message: `You were granted the ${input.role} role. Sign in again to pick up the new permissions.`,
        relatedEntityType: "organization",
        relatedEntityId: organizationId,
      });

      return member;
    },
    { userId: actor.userId, organizationId },
  );
}

export async function removeMember(
  organizationId: string,
  userId: string,
  actor: { userId: string; roles: Role[] },
): Promise<void> {
  return withTransaction(
    async () => {
      const members = await repo.listMembers(organizationId);
      const target = members.find((member) => member.userId === userId);
      if (!target) throw AppError.notFound("That user is not a member of this organization");

      // Refuse to remove the last administrator, which would leave the
      // organization with nobody able to manage it.
      const isAdmin = target.role === "org_admin" || target.role === "organization_admin";
      if (isAdmin && (await repo.countAdmins(organizationId)) <= 1) {
        throw AppError.unprocessable("Cannot remove the last administrator of an organization");
      }

      await repo.removeMember(organizationId, userId);

      await audit.appendAuditEvent({
        auctionId: null,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "organization_member",
        entityId: userId,
        action: "organization.member_revoked",
        payload: { organizationId, subjectUserId: userId, previousRole: target.role },
      });
    },
    { userId: actor.userId, organizationId },
  );
}
