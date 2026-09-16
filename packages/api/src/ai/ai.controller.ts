import type { RequestHandler } from "express";
import * as anomalyService from "./anomaly.service.js";
import * as assistantService from "./assistant.service.js";
import * as categorizationService from "./categorization.service.js";

export const categorize: RequestHandler = async (req, res, next) => {
  try {
    const { text } = req.body as { text: string };
    const result = await categorizationService.categorizeText(text);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const detectAnomaly: RequestHandler = async (req, res, next) => {
  try {
    const result = await anomalyService.detectAnomaly(req.body as Record<string, unknown>);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const assist: RequestHandler = async (req, res, next) => {
  try {
    const { prompt } = req.body as { prompt: string };
    const result = await assistantService.askAssistant(prompt);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
