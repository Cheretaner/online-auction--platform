import type { AddOrganizationMemberRequest, CreateOrganizationRequest } from "@auction/shared";
import { apiRequest, v1 } from "@/lib/api/client";
import type { ItemList, OrganizationMember, OrganizationRecord } from "@/lib/api/types";

export const organizationsApi = {
  list: () => apiRequest<ItemList<OrganizationRecord>>(v1("/organizations")),
  getById: (id: string) => apiRequest<OrganizationRecord>(v1(`/organizations/${id}`)),
  create: (body: CreateOrganizationRequest) =>
    apiRequest<OrganizationRecord>(v1("/organizations"), { method: "POST", body }),
  listMembers: (id: string) =>
    apiRequest<ItemList<OrganizationMember>>(v1(`/organizations/${id}/members`)),
  addMember: (id: string, body: AddOrganizationMemberRequest) =>
    apiRequest<OrganizationMember>(v1(`/organizations/${id}/members`), { method: "POST", body }),
  removeMember: (id: string, userId: string) =>
    apiRequest<void>(v1(`/organizations/${id}/members/${userId}`), {
      method: "DELETE",
      parse: "void",
    }),
};
