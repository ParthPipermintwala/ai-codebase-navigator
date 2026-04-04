import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (userId) => {
  try {
    console.log("Creating Stripe checkout session:", {
      userId,
      frontendUrl: process.env.FRONTEND_URL,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Premium Plan",
              description: "AI Chat + Codebase Tour + unlimited repo analysis",
            },
            unit_amount: 49900,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || "http://localhost:8080"}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:8080"}/subscription`,
      client_reference_id: userId,
      metadata: {
        userId,
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    console.log("Stripe session created successfully:", session.id);
    return { url: session.url };
  } catch (error) {
    console.error("Stripe API error details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
};

export const confirmCheckoutSession = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      throw new Error("Checkout session is not paid yet");
    }

    const userId = session.metadata?.userId;
    if (!userId) {
      throw new Error("Missing user metadata in checkout session");
    }

    // Update user subscription status in database
    const supabase = (await import("../config/supabase.js")).default;
    const { error: updateError } = await supabase
      .from("users")
      .update({ is_subscribed: true })
      .eq("id", userId);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to update subscription status in database");
    }

    console.log(
      "Payment confirmed and subscription activated for user:",
      userId,
    );
    return { userId, isSubscribed: true };
  } catch (error) {
    console.error("Error confirming checkout session:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to confirm checkout session");
  }
};

export const handleWebhook = async (event) => {
  try {
    const { type, data } = event;

    if (type === "checkout.session.completed") {
      const session = data.object;
      const userId = session.metadata?.userId;

      if (userId) {
        const supabase = (await import("../config/supabase.js")).default;
        await supabase
          .from("users")
          .update({ is_subscribed: true })
          .eq("id", userId);

        console.log(`User ${userId} upgraded to premium`);
      }
    }

    return { received: true };
  } catch (error) {
    console.error("Error handling webhook:", error);
    throw error instanceof Error
      ? error
      : new Error("Webhook processing failed");
  }
};
