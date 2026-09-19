import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./auction-item.controller.js";

// Uses mergeParams to access :auctionId from parent router
export const auctionItemRouter = Router({ mergeParams: true });

// All auction item routes require authentication
auctionItemRouter.use(requireAuth);

auctionItemRouter.post("/", controller.createAuctionItem);
auctionItemRouter.get("/", controller.getAuctionItems);
auctionItemRouter.get("/:id", controller.getAuctionItem);
auctionItemRouter.patch("/:id", controller.updateAuctionItem);
auctionItemRouter.delete("/:id", controller.deleteAuctionItem);
