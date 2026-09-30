import type {
  CancelAuctionRequest,
  CreateAuctionItemRequest,
  CreateAuctionRequest,
  PlaceBidRequest,
  TransitionAuctionRequest,
  UpdateAuctionItemRequest,
  UpdateAuctionRequest,
  WithdrawBidRequest,
} from "@auction/shared";
import { apiRequest, v1 } from "@/lib/api/client";
import type { Auction, AuctionItem, AuctionPage, BidRecord, ItemList } from "@/lib/api/types";

export interface PublicAuctionParams {
  q?: string;
  status?: string;
  categoryId?: string;
  orgId?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

function toQuery(params: PublicAuctionParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export const auctionsApi = {
  listPublic: (params: PublicAuctionParams = {}) =>
    apiRequest<AuctionPage>(v1(`/auctions${toQuery(params)}`)),
  getById: (id: string) => apiRequest<Auction>(v1(`/auctions/${id}`)),
  create: (body: CreateAuctionRequest) =>
    apiRequest<Auction>(v1("/auctions"), { method: "POST", body }),
  update: (id: string, body: UpdateAuctionRequest) =>
    apiRequest<Auction>(v1(`/auctions/${id}`), { method: "PATCH", body }),
  submit: (id: string) => apiRequest<Auction>(v1(`/auctions/${id}/submit`), { method: "POST" }),
  approve: (id: string) => apiRequest<Auction>(v1(`/auctions/${id}/approve`), { method: "POST" }),
  transition: (id: string, body: TransitionAuctionRequest) =>
    apiRequest<Auction>(v1(`/auctions/${id}/status`), { method: "PATCH", body }),
  cancel: (id: string, body: CancelAuctionRequest) =>
    apiRequest<Auction>(v1(`/auctions/${id}`), { method: "DELETE", body }),
  listByOrg: (orgId: string) =>
    apiRequest<ItemList<Auction>>(v1(`/organizations/${orgId}/auctions`)),
  listItems: (auctionId: string) =>
    apiRequest<ItemList<AuctionItem>>(v1(`/auctions/${auctionId}/items`)),
  getItem: (auctionId: string, itemId: string) =>
    apiRequest<AuctionItem>(v1(`/auctions/${auctionId}/items/${itemId}`)),
  createItem: (auctionId: string, body: CreateAuctionItemRequest) =>
    apiRequest<AuctionItem>(v1(`/auctions/${auctionId}/items`), { method: "POST", body }),
  updateItem: (auctionId: string, itemId: string, body: UpdateAuctionItemRequest) =>
    apiRequest<AuctionItem>(v1(`/auctions/${auctionId}/items/${itemId}`), {
      method: "PATCH",
      body,
    }),
  deleteItem: (auctionId: string, itemId: string) =>
    apiRequest<void>(v1(`/auctions/${auctionId}/items/${itemId}`), {
      method: "DELETE",
      parse: "void",
    }),
  listBids: (auctionId: string) =>
    apiRequest<ItemList<BidRecord>>(v1(`/auctions/${auctionId}/bids`)),
  placeBid: (auctionId: string, body: PlaceBidRequest, idempotencyKey: string) =>
    apiRequest(v1(`/auctions/${auctionId}/bids`), {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  withdrawBid: (auctionId: string, bidId: string, body: WithdrawBidRequest) =>
    apiRequest(v1(`/auctions/${auctionId}/bids/${bidId}/withdraw`), { method: "POST", body }),
  openSealed: (auctionId: string) =>
    apiRequest(v1(`/auctions/${auctionId}/bids/open-sealed`), { method: "POST" }),
};
