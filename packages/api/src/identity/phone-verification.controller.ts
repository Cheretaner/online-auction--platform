import type { RequestHandler } from "express";
import { getAuth } from "../shared/types/request.js";
import * as service from "./phone-verification.service.js";
import { HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";

/**
 * POST /api/v1/auth/phone/request-verification
 * Request phone number verification code
 */
export const requestVerification: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "BAD_REQUEST",
        message: "phoneNumber is required",
      });
      return;
    }

    const result = await service.requestPhoneVerification(auth.userId, phoneNumber);

    logger.info({ event: "phone:verification_requested_api", userId: auth.userId });

    res.json({
      message: "Verification code sent to your phone",
      codeSent: result.codeSent,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/phone/verify
 * Verify phone number with code
 */
export const verifyPhone: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { code } = req.body;

    if (!code) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "BAD_REQUEST",
        message: "code is required",
      });
      return;
    }

    const result = await service.verifyPhoneNumber(auth.userId, code);

    logger.info({ event: "phone:verified_api", userId: auth.userId });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/phone/status
 * Get phone verification status
 */
export const getStatus: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const status = await service.getPhoneStatus(auth.userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/auth/phone
 * Remove phone number from profile
 */
export const removePhone: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    await service.removePhoneNumber(auth.userId);

    logger.info({ event: "phone:removed_api", userId: auth.userId });

    res.status(HttpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};
