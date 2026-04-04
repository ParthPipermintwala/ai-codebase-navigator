import express from "express";
import {
  createCheckoutSessionHandler,
  confirmCheckoutSessionHandler,
  webhookHandler,
} from "../controller/payment.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/create-checkout-session",
  authMiddleware,
  createCheckoutSessionHandler,
);
router.get("/confirm-session", confirmCheckoutSessionHandler);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookHandler,
);

export default router;
