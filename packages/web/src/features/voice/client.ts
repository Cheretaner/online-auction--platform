import { VoxideClient } from "@voxide/react";
import { AUCTION_STATUS } from "@auction/shared";
import { env } from "@/config/env";
import { auctionsApi } from "@/lib/api/auctions";
import { tokenStore } from "@/lib/auth/token-store";
import { router } from "@/app/router";
import type { Auction } from "@/lib/api/types";

function publicAuctionSummary(auction: Auction) {
  return {
    id: auction.id,
    title: auction.title,
    description: auction.description,
    status: auction.status,
    type: auction.auctionType,
    region: auction.region,
    startingPrice: auction.startPrice,
    currentPrice: auction.currentHighestBid,
    bidCount: auction.bidCount,
    opensAt: auction.opensAt,
    closesAt: auction.closesAt,
  };
}

function createVoiceClient(publicKey: string) {
  const client = new VoxideClient({ publicKey, language: "en-US" });

  client.bindState(() => ({
    currentRoute: window.location.pathname,
    isAuthenticated: Boolean(tokenStore.getAccessToken()),
  }));

  client.enableNavigation(
    { push: (path) => void router.navigate(path) },
    {
      "/": "Public auction home page",
      "/auctions": "Browse public auctions",
      "/login": "Sign in",
      "/register": "Create an account",
    },
  );
  client.setActiveRoute(router.state.location.pathname);
  router.subscribe((state) => client.setActiveRoute(state.location.pathname));

  client.register({
    browsePublicAuctions: {
      description:
        "Find and summarize auctions in the public catalogue. Filter by a search phrase and an optional public auction status. This action only reads public auction listings.",
      params: {
        search: {
          type: "string",
          description:
            "Optional phrase to match against auction titles and regions.",
        },
        status: {
          type: "string",
          enum: AUCTION_STATUS.filter((status) =>
            ["scheduled", "live", "closed", "under_review", "awarded"].includes(
              status,
            ),
          ),
          description: "Optional public auction status filter.",
        },
      },
      handler: async ({ search, status }) => {
        const response = await auctionsApi.listPublic();
        const phrase =
          typeof search === "string" ? search.trim().toLocaleLowerCase() : "";
        const statusFilter = typeof status === "string" ? status : "";
        const auctions = response.items.filter((auction) => {
          const matchesPhrase =
            !phrase ||
            auction.title.toLocaleLowerCase().includes(phrase) ||
            (auction.region ?? "").toLocaleLowerCase().includes(phrase);
          return (
            matchesPhrase && (!statusFilter || auction.status === statusFilter)
          );
        });

        return {
          count: auctions.length,
          auctions: auctions.slice(0, 10).map(publicAuctionSummary),
          note:
            auctions.length > 10 ? "Showing the first 10 matches." : undefined,
        };
      },
    },
    openPublicAuction: {
      description:
        "Open a public auction listing after confirming it appears in the public catalogue. Ask the user which auction if its ID is unclear.",
      params: {
        auctionId: {
          type: "string",
          required: true,
          description: "ID of an auction returned by browsePublicAuctions.",
        },
      },
      handler: async ({ auctionId }) => {
        if (typeof auctionId !== "string")
          return { opened: false, reason: "A valid auction ID is required." };
        const response = await auctionsApi.listPublic();
        const auction = response.items.find((item) => item.id === auctionId);
        if (!auction)
          return {
            opened: false,
            reason: "That auction is not in the public catalogue.",
          };

        void router.navigate(`/auctions/${encodeURIComponent(auction.id)}`);
        return { opened: true, auction: publicAuctionSummary(auction) };
      },
    },
  });

  return client;
}

export const voxideClient = env.voxidePublicKey
  ? createVoiceClient(env.voxidePublicKey)
  : null;
