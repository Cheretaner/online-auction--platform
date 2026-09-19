import { Router } from "express";
import { submitVerification, reviewVerification, listPending, checkDuplicates } from "./verification.controller.js";
import { requireAuth } from "../shared/middleware/auth.middleware.js";

const router = Router();

router.post("/submit", requireAuth, submitVerification);
router.get("/pending", requireAuth, listPending);
router.post("/:id/review", requireAuth, reviewVerification);
router.get("/users/:userId/duplicates", requireAuth, checkDuplicates);

export default router;
