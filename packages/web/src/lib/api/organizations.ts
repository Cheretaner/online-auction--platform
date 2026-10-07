import type {
  AddOrganizationMemberRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
} from "@auction/shared";
import { apiRequest, v1 } from "@/lib/api/client";
import type { AdminUserRecord, ItemList, OrganizationMember, OrganizationRecord } from "@/lib/api/types";

export const organizationsApi = {
  list: () => apiRequest<ItemList<OrganizationRecord>>(v1("/organizations")),
  getById: (id: string) => apiRequest<OrganizationRecord>(v1(`/organizations/${id}`)),
  create: (body: CreateOrganizationRequest) =>
    apiRequest<OrganizationRecord>(v1("/organizations"), { method: "POST", body }),
  update: (id: string, body: UpdateOrganizationRequest) =>
    apiRequest<OrganizationRecord>(v1(`/organizations/${id}`), { method: "PATCH", body }),
  delete: (id: string) =>
    apiRequest<void>(v1(`/organizations/${id}`), { method: "DELETE", parse: "void" }),
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

export const usersApi = {
  list: () => apiRequest<ItemList<AdminUserRecord>>(v1("/auth/users")),
  create: (body: CreateUserRequest) =>
    apiRequest<AdminUserRecord>(v1("/auth/users"), { method: "POST", body }),
  update: (id: string, body: UpdateUserRequest) =>
    apiRequest<AdminUserRecord>(v1(`/auth/users/${id}`), { method: "PATCH", body }),
  deactivate: (id: string) =>
    apiRequest<void>(v1(`/auth/users/${id}`), { method: "DELETE", parse: "void" }),
};
