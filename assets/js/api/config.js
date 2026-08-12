/* Public browser configuration only. Never place server or provider secrets here. */
const builtApiBaseUrl = "__SHOPWISE_API_BASE_URL__";
const builtStripePublishableKey = "__STRIPE_PUBLISHABLE_KEY__";

window.ShopwiseConfig = Object.freeze({
  apiBaseUrl: builtApiBaseUrl.startsWith("__")
    ? "https://brilliant-mercy-production-c94f.up.railway.app/api/v1"
    : builtApiBaseUrl,
  stripePublishableKey: builtStripePublishableKey.startsWith("__")
    ? ""
    : builtStripePublishableKey,
  loginUrl: "/pages/auth/login.html",
  ownerUrl: "/pages/admin/owner.html",
  shopkeeperUrl: "/pages/shop/shopkeeper.html",
});
