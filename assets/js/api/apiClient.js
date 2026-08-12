(function () {
  const config = window.ShopwiseConfig;
  const storageKey = "shopwise.session";
  let refreshPromise = null;

  class ApiError extends Error {
    constructor(
      message,
      {
        status = 0,
        code = "REQUEST_FAILED",
        details = null,
        requestId = null,
      } = {},
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
      this.requestId = requestId;
    }
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || null;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  function writeSession(session) {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  }

  function clearSession() {
    writeSession(null);
    sessionStorage.removeItem("shopwise.checkoutRequestId");
  }

  function buildUrl(path, query) {
    const url = new URL(
      `${config.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    );
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "")
        url.searchParams.set(key, value);
    });
    return url.toString();
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;
    if (!response.ok || payload?.success === false) {
      const error = payload?.error || {};
      throw new ApiError(
        error.message || `Request failed with HTTP ${response.status}`,
        {
          status: response.status,
          code: error.code || "REQUEST_FAILED",
          details: error.details || null,
          requestId: payload?.requestId || response.headers.get("x-request-id"),
        },
      );
    }
    return {
      data: payload?.data ?? payload,
      requestId: payload?.requestId || null,
    };
  }

  async function refreshSession() {
    if (refreshPromise) return refreshPromise;
    const current = readSession();
    if (!current?.refreshToken)
      throw new ApiError("Session expired", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    refreshPromise = fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(parseResponse)
      .then(({ data }) => {
        const next = {
          ...current,
          ...data.session,
          user: data.user || current.user,
        };
        writeSession(next);
        return next;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  async function request(path, options = {}) {
    const {
      method = "GET",
      body,
      query,
      auth = true,
      retryAuth = true,
      headers = {},
    } = options;
    const session = readSession();
    const requestHeaders = { Accept: "application/json", ...headers };
    if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
    if (auth && session?.accessToken)
      requestHeaders.Authorization = `Bearer ${session.accessToken}`;
    try {
      const response = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return await parseResponse(response);
    } catch (error) {
      if (auth && retryAuth && error.status === 401 && session?.refreshToken) {
        try {
          await refreshSession();
          return request(path, { ...options, retryAuth: false });
        } catch (refreshError) {
          clearSession();
          window.dispatchEvent(new CustomEvent("shopwise:session-expired"));
          throw refreshError;
        }
      }
      throw error;
    }
  }

  window.ApiClient = {
    request,
    readSession,
    writeSession,
    clearSession,
    refreshSession,
    ApiError,
  };
})();
