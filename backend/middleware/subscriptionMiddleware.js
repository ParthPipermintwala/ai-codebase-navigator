import supabase from "../config/supabase.js";

export const subscriptionMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, is_subscribed")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!Boolean(user.is_subscribed)) {
      return res.status(402).json({ message: "Subscription required" });
    }

    next();
  } catch (error) {
    console.error("Subscription middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
