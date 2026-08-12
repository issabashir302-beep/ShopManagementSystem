(function () {
  const { request, readSession, writeSession, clearSession } = window.ApiClient;

  function saveAuthPayload(payload) {
    if (!payload?.session) return null;
    const stored = {
      accessToken: payload.session.accessToken,
      refreshToken: payload.session.refreshToken,
      expiresAt: payload.session.expiresAt,
      tokenType: payload.session.tokenType,
      user: payload.user,
    };
    writeSession(stored);
    return stored;
  }

  async function login(email, password) {
    const { data } = await request("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    saveAuthPayload(data);
    return hydrateIdentity();
  }

  async function signup(input) {
    const { data } = await request("/auth/signup", {
      method: "POST",
      auth: false,
      body: input,
    });
    saveAuthPayload(data);
    return data.session ? hydrateIdentity() : data;
  }

  async function hydrateIdentity() {
    const [{ data: session }, { data: profile }] = await Promise.all([
      request("/auth/session"),
      request("/users/me"),
    ]);
    const current = readSession();
    writeSession({ ...current, user: session.user, profile });
    return { user: session.user, profile };
  }

  async function requireRole(role) {
    if (!readSession()?.accessToken) {
      redirectToLogin("Please sign in to continue.");
      throw new Error("Authentication required");
    }
    const identity = await hydrateIdentity();
    if (identity.profile.userRole !== role) {
      location.replace(
        identity.profile.userRole === "owner"
          ? window.ShopwiseConfig.ownerUrl
          : window.ShopwiseConfig.shopkeeperUrl,
      );
      throw new Error("Role does not permit this workspace");
    }
    return identity;
  }

  async function logout() {
    try {
      if (readSession()?.accessToken)
        await request("/auth/logout", { method: "POST", retryAuth: false });
    } finally {
      clearSession();
      location.replace(window.ShopwiseConfig.loginUrl);
    }
  }

  function redirectToLogin(message) {
    clearSession();
    if (message) sessionStorage.setItem("shopwise.authMessage", message);
    location.replace(window.ShopwiseConfig.loginUrl);
  }

  window.addEventListener("shopwise:session-expired", () =>
    redirectToLogin("Your session expired. Please sign in again."),
  );
  window.AuthSession = {
    login,
    signup,
    logout,
    hydrateIdentity,
    requireRole,
    redirectToLogin,
    read: readSession,
  };
})();
