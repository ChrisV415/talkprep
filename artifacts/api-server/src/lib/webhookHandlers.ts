import type Stripe from "stripe";
import { storage } from "./storage";
import { logger } from "./logger";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metaUserId = session.metadata?.userId ?? null;

      if (session.mode === "payment") {
        // One-time payment → grant lifetime pro override
        let userId = metaUserId;
        if (!userId && typeof session.customer === "string") {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          userId = user?.id ?? null;
        }
        if (userId) {
          await storage.grantProOverride(userId, "Single Session purchase");
          logger.info({ userId }, "Granted pro override for single-session purchase");
        }
      } else if (
        session.mode === "subscription" &&
        typeof session.subscription === "string"
      ) {
        // Subscription → save subscription ID so status checks work
        let userId = metaUserId;
        if (!userId && typeof session.customer === "string") {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          userId = user?.id ?? null;
        }
        if (userId) {
          await storage.updateUserStripeInfo(userId, {
            stripeSubscriptionId: session.subscription,
          });
          logger.info(
            { userId, subscriptionId: session.subscription },
            "Saved subscription ID after checkout",
          );
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription cancelled — clear it from our records
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await storage.getUserByStripeCustomerId(customerId);
      if (user) {
        await storage.updateUserStripeInfo(user.id, {
          stripeSubscriptionId: undefined,
        });
        logger.info({ userId: user.id }, "Cleared subscription after cancellation");
      }
      break;
    }

    default:
      // Unhandled event types are silently ignored
      break;
  }
}
