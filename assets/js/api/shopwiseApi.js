(function () {
  const call = (path, options) =>
    ApiClient.request(path, options).then((result) => result.data);
  const qs = (value) => value || undefined;

  window.ShopwiseApi = {
    profile: {
      get: () => call("/users/me"),
      update: (body) => call("/users/me", { method: "PATCH", body }),
    },
    shop: {
      get: () => call("/shops/me"),
      create: (body) => call("/shops", { method: "POST", body }),
      update: (body) => call("/shops/me", { method: "PATCH", body }),
    },
    shopkeepers: {
      list: () => call("/shopkeepers"),
      get: (id) => call(`/shopkeepers/${id}`),
      create: (body) => call("/shopkeepers", { method: "POST", body }),
      update: (id, body) =>
        call(`/shopkeepers/${id}`, { method: "PATCH", body }),
      setActive: (id, isActive) =>
        call(`/shopkeepers/${id}/status`, {
          method: "PATCH",
          body: { isActive },
        }),
      resetPassword: (id) =>
        call(`/shopkeepers/${id}/reset-password`, { method: "POST" }),
    },
    products: {
      list: ({
        search,
        category,
        status = "active",
        page = 1,
        pageSize = 100,
      } = {}) =>
        call("/products", {
          query: {
            search: qs(search),
            category: qs(category),
            status,
            page,
            pageSize,
          },
        }),
      get: (id) => call(`/products/${id}`),
      create: (body) => call("/products", { method: "POST", body }),
      update: (id, body) => call(`/products/${id}`, { method: "PATCH", body }),
      archive: (id) => call(`/products/${id}`, { method: "DELETE" }),
    },
    inventory: {
      list: ({ search, category, page = 1, pageSize = 100 } = {}) =>
        call("/inventory", {
          query: { search: qs(search), category: qs(category), page, pageSize },
        }),
      lowStock: ({ page = 1, pageSize = 100 } = {}) =>
        call("/inventory/low-stock", { query: { page, pageSize } }),
      get: (productId) => call(`/products/${productId}/inventory`),
      movements: (productId, { page = 1, pageSize = 50 } = {}) =>
        call(`/products/${productId}/inventory/movements`, {
          query: { page, pageSize },
        }),
      adjust: (productId, body) =>
        call(`/products/${productId}/inventory/adjustments`, {
          method: "POST",
          body,
        }),
    },
    sales: {
      list: ({ page = 1, limit = 50, dateFrom, dateTo, soldBy, status } = {}) =>
        call("/sales", {
          query: {
            page,
            limit,
            dateFrom: qs(dateFrom),
            dateTo: qs(dateTo),
            soldBy: qs(soldBy),
            status: qs(status),
          },
        }),
      get: (id) => call(`/sales/${id}`),
      checkout: (body) => call("/checkout", { method: "POST", body }),
      void: (id, reason) =>
        call(`/sales/${id}/void`, { method: "POST", body: { reason } }),
      returnItems: (id, items, reason) =>
        call(`/sales/${id}/returns`, {
          method: "POST",
          body: { items, reason },
        }),
    },
    payments: {
      forSale: (saleId, { page = 1, limit = 50 } = {}) =>
        call(`/sales/${saleId}/payments`, { query: { page, limit } }),
      get: (id) => call(`/payments/${id}`),
      createStripeIntent: (saleId) =>
        call("/payments/stripe/create-intent", {
          method: "POST",
          body: { saleId },
        }),
    },
    reports: {
      daily: (date) =>
        call("/reports/daily-sales", { query: { date: qs(date) } }),
      monthly: (month) =>
        call("/reports/monthly-sales", { query: { month: qs(month) } }),
      products: (month) =>
        call("/reports/products", { query: { month: qs(month) } }),
      inventory: (month) =>
        call("/reports/inventory", { query: { month: qs(month) } }),
      profit: (month) =>
        call("/reports/profit", { query: { month: qs(month) } }),
      summary: (month) =>
        call("/reports/monthly-summary", { query: { month: qs(month) } }),
      email: (month) =>
        call("/reports/monthly-summary/email", {
          method: "POST",
          body: month ? { month } : {},
        }),
    },
  };
})();
