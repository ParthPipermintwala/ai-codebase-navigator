import Stripe from "stripe";
import {
  createCheckoutSession,
  confirmCheckoutSession,
  handleWebhook,
} from "../services/stripe.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSessionHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    console.log("Creating checkout session for userId:", userId);

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = await createCheckoutSession(userId);
    console.log("Checkout session created successfully:", session);
    res.json(session);
  } catch (error) {
    console.error("Error in createCheckoutSessionHandler:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const confirmCheckoutSessionHandler = async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "session_id is required" });
    }

    const result = await confirmCheckoutSession(sessionId);

    res.json(result);
  } catch (error) {
    console.error("Error in confirmCheckoutSessionHandler:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to confirm session" });
  }
};

export const webhookHandler = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.log("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const result = await handleWebhook(event);
    res.json(result);
  } catch (error) {
    console.error("Error in webhookHandler:", error);
    res
      .status(500)
      .json({ error: error.message || "Webhook processing failed" });
  }
};
