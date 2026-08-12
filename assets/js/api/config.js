/* Public runtime configuration only. Never place server or provider secrets here. */
window.ShopwiseConfig = Object.freeze({
  apiBaseUrl: "http://localhost:5000/api/v1",
  stripePublishableKey: "",
  loginUrl: "/pages/auth/login.html",
  ownerUrl: "/pages/admin/owner.html",
  shopkeeperUrl: "/pages/shop/shopkeeper.html",
});
