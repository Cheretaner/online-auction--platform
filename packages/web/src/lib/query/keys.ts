export const queryKeys = {
  health: ["health"] as const,
  me: ["auth", "me"] as const,
  session: ["auth", "session"] as const,
  auctions: {
    all: ["auctions"] as const,
    public: (params: object = {}) => ["auctions", "public", params] as const,
    detail: (id: string) => ["auctions", "detail", id] as const,
    org: (orgId: string) => ["auctions", "org", orgId] as const,
    items: (auctionId: string) => ["auctions", auctionId, "items"] as const,
    item: (auctionId: string, itemId: string) => ["auctions", auctionId, "items", itemId] as const,
    bids: (auctionId: string) => ["auctions", auctionId, "bids"] as const,
    documents: (auctionId: string) => ["documents", "auction", auctionId] as const,
  },
  organizations: {
    all: ["organizations"] as const,
    list: () => ["organizations", "list"] as const,
    detail: (id: string) => ["organizations", "detail", id] as const,
    members: (id: string) => ["organizations", id, "members"] as const,
  },
  categories: {
    all: ["categories"] as const,
    detail: (id: string) => ["categories", id] as const,
  },
  deposits: {
    mine: ["deposits", "me"] as const,
    auction: (auctionId: string) => ["deposits", "auction", auctionId] as const,
    detail: (id: string) => ["deposits", id] as const,
  },
  documents: {
    mine: ["documents", "me"] as const,
    detail: (id: string) => ["documents", id] as const,
  },
  verification: {
    mine: ["verification", "me"] as const,
    pending: ["verification", "pending"] as const,
    duplicates: (userId: string) => ["verification", "duplicates", userId] as const,
  },
  notifications: {
    list: (unread?: boolean) => ["notifications", { unread }] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  disputes: {
    list: (auctionId?: string) => ["disputes", { auctionId }] as const,
    detail: (id: string) => ["disputes", id] as const,
  },
  reports: {
    list: (auctionId?: string) => ["reports", { auctionId }] as const,
    detail: (id: string) => ["reports", id] as const,
  },
  audit: {
    events: ["audit", "events"] as const,
    verify: ["audit", "verify"] as const,
    verifyAuction: (auctionId: string) => ["audit", "verify", auctionId] as const,
  },
  compliance: {
    checks: (auctionId: string) => ["compliance", auctionId] as const,
  },
  ai: {
    anomalies: (auctionId?: string) => ["ai", "anomalies", { auctionId }] as const,
  },
  telegram: {
    status: ["telegram", "status"] as const,
  },
  autofetch: {
    sources: ["autofetch", "sources"] as const,
    pending: (filters?: unknown) => ["autofetch", "pending", filters] as const,
    stats: ["autofetch", "stats"] as const,
  },
};
