import { Router } from "express";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import * as controller from "./open-data.controller.js";

export const openDataRouter = Router();

openDataRouter.get("/auctions", asyncHandler(controller.listAuctions));
openDataRouter.get("/weekly.csv", asyncHandler(controller.weeklyCsv));
