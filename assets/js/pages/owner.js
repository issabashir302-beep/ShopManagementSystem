(function () {
  const { $, $$, money, status, icon, toast, openModal, closeModal } = UI;
  const api = ShopwiseApi;
  const state = {
    profile: null,
    shop: null,
    products: [],
    inventory: [],
    shopkeepers: [],
    sales: [],
    report: null,
  };
  const routes = [
    ["overview", "Overview", "grid"],
    ["products", "Products", "box"],
    ["inventory", "Inventory", "layers"],
    ["sales", "Sales", "receipt"],
    ["shopkeepers", "Shopkeepers", "users"],
    ["payments", "Payments", "card"],
    ["reports", "Reports", "chart"],
    ["settings", "Shop Settings", "settings"],
    ["profile", "Profile", "user"],
  ];

  function setNavigationOpen(open) {
    $("#appShell").classList.toggle("nav-open", open);
    document.body.classList.toggle("navigation-locked", open);
    $("[data-open-nav]").setAttribute("aria-expanded", String(open));
  }

  function renderNavigation() {
    const labels = {
      0: "Overview",
      1: "Operations",
      4: "Team",
      6: "Insights",
      7: "Settings",
    };
    $("#ownerNav").innerHTML = routes
      .map(
        (route, index) =>
          `${labels[index] ? `<div class="nav-label">${labels[index]}</div>` : ""}<a class="nav-link" href="#${route[0]}" data-route="${route[0]}">${icon(route[2])}<span>${route[1]}</span></a>`,
      )
      .join("");
    $("[data-open-nav]").setAttribute("aria-expanded", "false");
    $("[data-open-nav]").onclick = () => setNavigationOpen(true);
    $$("[data-close-nav]").forEach((element) => {
      element.onclick = () => setNavigationOpen(false);
    });
  }

  const pageHeader = (title, description, action = "") =>
    `<div class="page-header"><div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="header-actions">${action}</div>` : ""}</div>`;
  const loading = (label) =>
    `<section class="card card-body" role="status"><div class="skeleton" style="height:16px;width:180px;margin-bottom:14px">${label}</div><div class="skeleton" style="height:44px;margin-bottom:8px">Loading</div><div class="skeleton" style="height:44px">Loading</div></section>`;
  const errorState = (title, error, retry = true) =>
    `<section class="card empty-state"><div class="empty-icon">${icon("x")}</div><h3>${title}</h3><p>${escapeHtml(error.message || "The request could not be completed.")}</p>${retry ? '<button class="btn btn-secondary" data-retry>Try again</button>' : ""}</section>`;
  const emptyState = (title, description, action = "") =>
    `<div class="empty-state"><div class="empty-icon">${icon("box")}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;
  const tableFooter = (pagination) =>
    `<div class="table-footer"><span>${pagination.total} record${pagination.total === 1 ? "" : "s"}</span><div class="inline-actions"><button class="btn btn-secondary btn-icon" data-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""}>‹</button><span>Page ${pagination.page} of ${Math.max(1, pagination.totalPages)}</span><button class="btn btn-secondary btn-icon" data-page="${pagination.page + 1}" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>›</button></div></div>`;
  const productCell = (item) =>
    `<div class="product-cell"><div class="product-initial">${escapeHtml(item.name?.[0] || "P")}</div><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category || "Uncategorised")}</span></div></div>`;
  const actionMenu = (type, id, active = true) =>
    `<div class="kebab"><button class="btn btn-ghost btn-icon" data-menu-toggle aria-label="Actions">${icon("more")}</button><div class="menu"><button data-action="view" data-type="${type}" data-id="${id}">View details</button><button data-action="edit" data-type="${type}" data-id="${id}">Edit</button>${type === "staff" ? `<button data-action="reset" data-type="staff" data-id="${id}">Reset password</button><button data-action="status" data-type="staff" data-id="${id}" data-active="${active}">${active ? "Deactivate" : "Reactivate"}</button>` : `<button data-action="archive" data-type="product" data-id="${id}">Archive</button>`}</div></div>`;
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("en-KE", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  const number = (value) => Number(value || 0);

  async function initialize() {
    renderNavigation();
    $("#todayLabel").textContent = new Intl.DateTimeFormat("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date());
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        $("#appShell").classList.contains("nav-open")
      )
        setNavigationOpen(false);
    });
    document.addEventListener("click", handleGlobalClick);
    window.addEventListener("hashchange", renderRoute);
    try {
      const identity = await AuthSession.requireRole("owner");
      state.profile = identity.profile;
      updateIdentity();
      try {
        state.shop = await api.shop.get();
      } catch (error) {
        if (error.code === "SHOP_NOT_FOUND") return renderShopOnboarding();
        throw error;
      }
      await renderRoute();
    } catch (error) {
      if (
        error.message.includes("Authentication required") ||
        error.message.includes("Role does not permit")
      )
        return;
      $("#pageContent").innerHTML = errorState(
        "Unable to open the owner workspace",
        error,
      );
    }
  }

  function updateIdentity() {
    const initials = (state.profile.fullName || "Owner")
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    $$(".avatar").forEach((element) => {
      element.textContent = initials;
    });
    const meta = $(".sidebar-user .user-meta");
    if (meta)
      meta.innerHTML = `<strong>${escapeHtml(state.profile.fullName || "Shop owner")}</strong><span>${escapeHtml(state.profile.email)}</span>`;
    $(".sidebar-user a[aria-label='Sign out']")?.setAttribute(
      "href",
      "#logout",
    );
  }

  async function renderRoute() {
    if (!state.shop) return;
    const requested = location.hash.slice(1) || "overview";
    const route = routes.some(([key]) => key === requested)
      ? requested
      : "overview";
    setNavigationOpen(false);
    $("#topbarTitle").textContent = routes.find(([key]) => key === route)[1];
    $$(".nav-link").forEach((link) =>
      link.classList.toggle("active", link.dataset.route === route),
    );
    $("#pageContent").innerHTML = loading(`Loading ${route}…`);
    try {
      const renderers = {
        overview: renderOverview,
        products: renderProducts,
        inventory: renderInventory,
        sales: renderSales,
        shopkeepers: renderShopkeepers,
        payments: renderPayments,
        reports: renderReports,
        settings: renderSettings,
        profile: renderProfile,
      };
      await renderers[route]();
    } catch (error) {
      if (error.status === 403) toast("Permission denied", error.message);
      $("#pageContent").innerHTML = errorState(
        `Unable to load ${route}`,
        error,
      );
    }
  }

  async function renderOverview() {
    const [daily, lowStock, sales] = await Promise.all([
      api.reports.daily(),
      api.inventory.lowStock({ pageSize: 5 }),
      api.sales.list({ limit: 5 }),
    ]);
    const totals = daily.totals || {};
    const transactions = totals.transactions ?? totals.salesCount ?? 0;
    const revenue =
      totals.totalSales ?? totals.grossRevenue ?? totals.revenue ?? 0;
    const profit = totals.grossProfit ?? 0;
    $("#pageContent").innerHTML =
      `${pageHeader(`Good ${greeting()}, ${firstName()}`, `Live activity for ${escapeHtml(state.shop.name)}.`, '<a class="btn btn-secondary" href="../shop/shopkeeper.html">Open POS</a>')}<div class="stat-grid"><div class="card stat-card"><div class="stat-label">Today’s sales</div><div class="stat-value">${money(revenue)}</div><div class="stat-note">Authoritative completed sales</div></div><div class="card stat-card"><div class="stat-label">Transactions</div><div class="stat-value">${transactions}</div><div class="stat-note">Today</div></div><div class="card stat-card"><div class="stat-label">Gross profit</div><div class="stat-value">${money(profit)}</div><div class="stat-note">Sale-time cost snapshots</div></div><div class="card stat-card"><div class="stat-label">Low stock items</div><div class="stat-value warning">${lowStock.pagination.total}</div><div class="stat-note">At or below threshold</div></div></div><div class="dashboard-grid"><section class="card"><div class="card-header"><div><h2>Payment methods</h2><small>Completed payments today</small></div></div><div class="card-body bar-list">${renderBreakdown(daily.paymentMethods || daily.paymentBreakdown || [])}</div></section><section class="card"><div class="card-header"><div><h2>Low stock</h2><small>Needs attention</small></div><a href="#inventory">View inventory</a></div><div class="card-body stock-list">${lowStock.items.length ? lowStock.items.map((item) => `<div class="stock-item">${productCell(item)}<strong class="warning">${item.quantity} ${escapeHtml(item.unit)}</strong></div>`).join("") : '<p class="muted">No low-stock items.</p>'}</div></section></div>${salesTable("Recent sales", sales.items, sales.pagination)}`;
  }

  async function renderProducts(filters = {}) {
    const result = await api.products.list({
      ...filters,
      status: filters.status || "all",
    });
    state.products = result.items;
    $("#pageContent").innerHTML =
      `${pageHeader("Products", "Manage the items available in your shop.", `<button class="btn btn-primary" data-add-product>${icon("plus")}Add product</button>`)}${productToolbar(filters)}<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th class="numeric">Buying price</th><th class="numeric">Selling price</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${result.items.length ? result.items.map((item) => `<tr><td>${productCell(item)}</td><td>${escapeHtml(item.sku || "—")}</td><td>${escapeHtml(item.unit)}</td><td class="numeric">${money(number(item.buyingPrice))}</td><td class="numeric"><strong>${money(number(item.sellingPrice))}</strong></td><td>${status(item.isActive ? "Active" : "Archived")}</td><td>${actionMenu("product", item.id)}</td></tr>`).join("") : `<tr><td colspan="7">${emptyState("No products found", "Add the first product or adjust your filters.", '<button class="btn btn-primary" data-add-product>Add product</button>')}</td></tr>`}</tbody></table></div>${tableFooter(result.pagination)}</section>`;
    bindFilterForm("products", renderProducts);
  }

  function productToolbar(filters) {
    const categories = [
      ...new Set(state.products.map((item) => item.category).filter(Boolean)),
    ];
    return `<form class="toolbar" id="filterForm"><div class="field-inline">${icon("search")}<label class="sr-only" for="listSearch">Search products</label><input class="input" id="listSearch" name="search" value="${escapeHtml(filters.search || "")}" placeholder="Search name, SKU or barcode"></div><select class="select" name="category" aria-label="Category"><option value="">All categories</option>${categories.map((category) => `<option ${filters.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select><select class="select" name="status" aria-label="Status"><option value="all">All statuses</option><option value="active" ${filters.status === "active" ? "selected" : ""}>Active</option><option value="archived" ${filters.status === "archived" ? "selected" : ""}>Archived</option></select><button class="btn btn-secondary">Apply</button></form>`;
  }

  async function renderInventory(filters = {}) {
    const [inventory, low] = await Promise.all([
      api.inventory.list(filters),
      api.inventory.lowStock({ pageSize: 100 }),
    ]);
    state.inventory = inventory.items;
    $("#pageContent").innerHTML =
      `${pageHeader("Inventory", "Track current balances and make controlled adjustments.", `<button class="btn btn-primary" data-adjust-stock>${icon("plus")}Stock adjustment</button>`)}<div class="stat-grid"><div class="card stat-card"><div class="stat-label">Products tracked</div><div class="stat-value">${inventory.pagination.total}</div><div class="stat-note">Active catalog</div></div><div class="card stat-card"><div class="stat-label">Units in stock</div><div class="stat-value">${inventory.items.reduce((sum, item) => sum + number(item.quantity), 0)}</div><div class="stat-note">Current page</div></div><div class="card stat-card"><div class="stat-label">Low stock</div><div class="stat-value warning">${low.pagination.total}</div><div class="stat-note">At or below threshold</div></div><div class="card stat-card"><div class="stat-label">Out of stock</div><div class="stat-value">${inventory.items.filter((item) => number(item.quantity) <= 0).length}</div><div class="stat-note">Current page</div></div></div><form class="toolbar" id="filterForm"><div class="field-inline">${icon("search")}<input class="input" name="search" value="${escapeHtml(filters.search || "")}" placeholder="Search inventory" aria-label="Search inventory"></div><button class="btn btn-secondary">Apply</button></form><section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>SKU</th><th class="numeric">Current stock</th><th>Unit</th><th class="numeric">Threshold</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${inventory.items.length ? inventory.items.map((item) => `<tr><td>${productCell(item)}</td><td>${escapeHtml(item.sku || "—")}</td><td class="numeric"><strong>${item.quantity}</strong></td><td>${escapeHtml(item.unit)}</td><td class="numeric">${item.lowStockThreshold}</td><td>${status(number(item.quantity) <= 0 ? "Out of stock" : item.isLowStock ? "Low stock" : "Active")}</td><td>${formatDate(item.updatedAt)}</td><td><button class="btn btn-ghost" data-adjust-stock data-id="${item.productId}">Adjust</button><button class="btn btn-ghost" data-movements data-id="${item.productId}">History</button></td></tr>`).join("") : `<tr><td colspan="8">${emptyState("No inventory found", "Create a product to establish its inventory balance.")}</td></tr>`}</tbody></table></div>${tableFooter(inventory.pagination)}</section>`;
    bindFilterForm("inventory", renderInventory);
  }

  async function renderShopkeepers() {
    state.shopkeepers = await api.shopkeepers.list();
    $("#pageContent").innerHTML =
      `${pageHeader("Shopkeepers", "Manage who can operate your POS.", `<button class="btn btn-primary" data-add-staff>${icon("plus")}Add shopkeeper</button>`)}<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Username</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${state.shopkeepers.length ? state.shopkeepers.map((item) => `<tr><td><strong>${escapeHtml(item.fullName)}</strong></td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone || "—")}</td><td>${escapeHtml(item.username || "—")}</td><td>${status(item.isActive ? "Active" : "Inactive")}</td><td>${formatDate(item.updatedAt)}</td><td>${actionMenu("staff", item.id, item.isActive)}</td></tr>`).join("") : `<tr><td colspan="7">${emptyState("No shopkeepers yet", "You can operate the POS yourself or add a shopkeeper.", '<button class="btn btn-primary" data-add-staff>Add shopkeeper</button>')}</td></tr>`}</tbody></table></div></section>`;
  }

  async function renderSales(filters = {}) {
    const result = await api.sales.list(filters);
    state.sales = result.items;
    $("#pageContent").innerHTML =
      `${pageHeader("Sales", "Review persisted transactions, payment state and returns.")}<form class="toolbar" id="filterForm"><input class="input" type="date" name="dateFrom" value="${filters.dateFrom || ""}" aria-label="From date"><input class="input" type="date" name="dateTo" value="${filters.dateTo || ""}" aria-label="To date"><select class="select" name="status"><option value="">All statuses</option><option value="completed">Completed</option><option value="voided">Voided</option><option value="refunded">Refunded</option></select><button class="btn btn-secondary">Apply</button></form>${salesTable("Transaction history", result.items, result.pagination)}`;
    bindFilterForm("sales", renderSales);
  }

  function salesTable(title, items, pagination) {
    return `<section class="card table-card"><div class="card-header"><div><h2>${title}</h2><small>Authoritative sale records</small></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Receipt</th><th>Date / time</th><th class="numeric">Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${items.length ? items.map((sale) => `<tr data-sale-id="${sale.id}" tabindex="0"><td><strong>${escapeHtml(sale.receiptNumber)}</strong></td><td>${formatDate(sale.createdAt)}</td><td class="numeric"><strong>${money(number(sale.totalAmount))}</strong></td><td>${friendly(sale.paymentStatus)}</td><td>${status(friendly(sale.status))}</td></tr>`).join("") : `<tr><td colspan="5">${emptyState("No sales found", "Completed transactions will appear here.")}</td></tr>`}</tbody></table></div>${pagination ? tableFooter(pagination) : ""}</section>`;
  }

  async function renderPayments() {
    const salesResult = await api.sales.list({ limit: 50 });
    const details = await Promise.all(
      salesResult.items.map((sale) => api.sales.get(sale.id)),
    );
    const payments = details.flatMap((detail) =>
      detail.payments.map((payment) => ({
        ...payment,
        receiptNumber: detail.sale.receiptNumber,
      })),
    );
    $("#pageContent").innerHTML =
      `${pageHeader("Payments", "Payment records are read-only and controlled by checkout and provider workflows.")}<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Payment</th><th>Sale</th><th>Method</th><th class="numeric">Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${payments.length ? payments.map((item) => `<tr><td><strong>${escapeHtml(item.providerReference || item.id)}</strong></td><td>${escapeHtml(item.receiptNumber)}</td><td>${friendly(item.method)}</td><td class="numeric">${money(number(item.amount))}</td><td>${status(friendly(item.status))}</td><td>${formatDate(item.createdAt)}</td></tr>`).join("") : `<tr><td colspan="6">${emptyState("No payments yet", "Payments are created automatically during checkout.")}</td></tr>`}</tbody></table></div></section>`;
  }

  async function renderReports(month = new Date().toISOString().slice(0, 7)) {
    state.report = await api.reports.summary(month);
    const report = state.report;
    const totals = report.totals || {};
    const transactionCount = number(totals.transactions ?? totals.salesCount);
    const totalSales = number(totals.totalSales ?? totals.grossRevenue);
    $("#pageContent").innerHTML =
      `${pageHeader("Reports", "Persisted shop performance for the selected month.", `<form id="reportPeriod"><input class="input" type="month" name="month" value="${month}"></form>`)}<div class="stat-grid"><div class="card stat-card"><div class="stat-label">Revenue</div><div class="stat-value">${money(totalSales)}</div><div class="stat-note">Completed sales</div></div><div class="card stat-card"><div class="stat-label">Transactions</div><div class="stat-value">${transactionCount}</div><div class="stat-note">${escapeHtml(report.period?.label || month)}</div></div><div class="card stat-card"><div class="stat-label">Gross profit</div><div class="stat-value">${money(number(totals.grossProfit))}</div><div class="stat-note">Historical cost snapshots</div></div><div class="card stat-card"><div class="stat-label">Average sale</div><div class="stat-value">${money(transactionCount ? totalSales / transactionCount : 0)}</div><div class="stat-note">Completed transactions</div></div></div><div class="report-grid"><section class="card"><div class="card-header"><h2>Top products</h2></div><div class="card-body bar-list">${renderTopProducts(report.topProducts || [])}</div></section><section class="card"><div class="card-header"><h2>Payment methods</h2></div><div class="card-body bar-list">${renderBreakdown(report.paymentMethods || [])}</div></section></div><section class="card" style="margin-top:16px"><div class="card-header"><div><h2>Monthly email report</h2><small>Sent only to the persisted owner email</small></div><button class="btn btn-secondary" data-send-report>Send report now</button></div><div class="card-body"><strong>${escapeHtml(report.period?.label || month)}</strong><p class="muted">The backend applies delivery idempotency and recipient controls.</p></div></section>`;
    $("#reportPeriod").onchange = (event) => renderReports(event.target.value);
  }

  async function renderSettings() {
    $("#pageContent").innerHTML =
      `${pageHeader("Shop settings", "Update the details used across operations and receipts.")}<div class="settings-layout">${settingsNav("settings")}<form class="card card-body" id="shopForm"><div class="form-grid">${field("Shop name", "name", state.shop.name, true)}${selectField("Shop type", "type", state.shop.type, ["Mini market", "Convenience shop", "General retail"])}${field("Address", "address", state.shop.address)}${field("City", "city", state.shop.city)}${field("Country", "country", state.shop.country)}${field("Currency", "currency", state.shop.currency, true)}</div><div class="modal-footer" style="padding:20px 0 0;margin-top:20px"><button class="btn btn-primary">Save changes</button></div></form></div>`;
    $("#shopForm").onsubmit = saveShop;
  }

  async function renderProfile() {
    state.profile = await api.profile.get();
    $("#pageContent").innerHTML =
      `${pageHeader("Profile", "Manage your personal contact details.")}<div class="settings-layout">${settingsNav("profile")}<form class="card card-body" id="profileForm"><div class="form-grid">${field("Full name", "fullName", state.profile.fullName, true)}${field("Username", "username", state.profile.username)}${field("Email", "email", state.profile.email, false, true)}${field("Phone", "phone", state.profile.phone)}</div><div class="modal-footer" style="padding:20px 0 0;margin-top:20px"><button class="btn btn-primary">Save changes</button></div></form></div>`;
    $("#profileForm").onsubmit = saveProfile;
  }

  function renderShopOnboarding() {
    $("#topbarTitle").textContent = "Set up your shop";
    $("#pageContent").innerHTML =
      `${pageHeader("Create your shop", "Add the shop details once to unlock products, inventory and checkout.")}<form class="card card-body" id="onboardingForm" style="max-width:720px"><div class="form-grid">${field("Shop name", "name", "", true)}${selectField("Shop type", "type", "Mini market", ["Mini market", "Convenience shop", "General retail"])}${field("Address", "address", "")}${field("City", "city", "")}${field("Country", "country", "Kenya")}${field("Currency", "currency", "KES", true)}</div><div class="modal-footer" style="padding:20px 0 0;margin-top:20px"><button class="btn btn-primary">Create shop</button></div></form>`;
    $("#onboardingForm").onsubmit = async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      setButtonLoading(button, true, "Creating shop…");
      try {
        state.shop = await api.shop.create(formObject(event.currentTarget));
        toast("Shop created", `${state.shop.name} is ready.`);
        await renderRoute();
      } catch (error) {
        toast("Unable to create shop", error.message);
      } finally {
        setButtonLoading(button, false, "Create shop");
      }
    };
  }

  async function handleGlobalClick(event) {
    if (event.target.closest('a[href="#logout"]')) {
      event.preventDefault();
      return AuthSession.logout();
    }
    if (event.target.closest("[data-retry]")) return renderRoute();
    if (event.target.closest("[data-add-product]")) return showProductModal();
    if (event.target.closest("[data-add-staff]")) return showStaffModal();
    const adjust = event.target.closest("[data-adjust-stock]");
    if (adjust) return showAdjustmentModal(adjust.dataset.id);
    const movements = event.target.closest("[data-movements]");
    if (movements) return showMovements(movements.dataset.id);
    const sale = event.target.closest("[data-sale-id]");
    if (sale) return showSale(sale.dataset.saleId);
    const action = event.target.closest("[data-action]");
    if (action) return handleAction(action);
    const send = event.target.closest("[data-send-report]");
    if (send) return sendReport(send);
  }

  async function handleAction(button) {
    const { action, type, id } = button.dataset;
    if (type === "product") {
      const product = await api.products.get(id);
      if (action === "view" || action === "edit")
        return showProductModal(product);
      if (action === "archive")
        return confirmMutation(
          `Archive ${product.name}?`,
          "It will no longer appear in active POS searches.",
          "Archive product",
          () => api.products.archive(id),
        );
    }
    const staff = await api.shopkeepers.get(id);
    if (action === "view" || action === "edit") return showStaffModal(staff);
    if (action === "reset")
      return confirmMutation(
        `Reset ${staff.fullName}’s password?`,
        "The backend will request its supported recovery email workflow.",
        "Send reset",
        () => api.shopkeepers.resetPassword(id),
      );
    if (action === "status")
      return confirmMutation(
        `${staff.isActive ? "Deactivate" : "Reactivate"} ${staff.fullName}?`,
        staff.isActive
          ? "They will immediately lose access to shop operations."
          : "They will regain access to the POS.",
        staff.isActive ? "Deactivate" : "Reactivate",
        () => api.shopkeepers.setActive(id, !staff.isActive),
      );
  }

  function showProductModal(product = null) {
    openModal({
      title: product ? "Edit product" : "Add product",
      body: `<form id="productForm"><div class="form-grid">${field("Product name", "name", product?.name, true)}${field("SKU", "sku", product?.sku)}${field("Barcode", "barcode", product?.barcode)}${field("Category", "category", product?.category)}${field("Unit", "unit", product?.unit, true)}${field("Buying price", "buyingPrice", product?.buyingPrice ?? "0", true, false, "number", "0.01")}${field("Selling price", "sellingPrice", product?.sellingPrice ?? "0", true, false, "number", "0.01")}${field("Low-stock threshold", "lowStockThreshold", product?.lowStockThreshold ?? "5", true, false, "number", "0.001")}</div><p class="muted" style="margin-top:14px">Stock quantity is managed only from Inventory.</p></form>`,
      actions:
        '<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" data-save-product>Save product</button>',
    });
    $("[data-save-product]").onclick = async (event) =>
      mutateModal(
        event.currentTarget,
        async () => {
          const body = formObject($("#productForm"));
          return product
            ? api.products.update(product.id, body)
            : api.products.create(body);
        },
        "Product saved",
      );
  }

  function showStaffModal(staff = null) {
    openModal({
      title: staff ? "Edit shopkeeper" : "Add shopkeeper",
      body: `<form id="staffForm"><p class="muted" style="margin-bottom:14px">${staff ? "Update safe profile fields." : "The shopkeeper will receive access to this shop’s POS."}</p><div class="form-grid">${field("Full name", "fullName", staff?.fullName, true)}${staff ? "" : field("Email", "email", "", true, false, "email")}${field("Phone", "phone", staff?.phone)}${field("Username", "username", staff?.username)}${staff ? "" : field("Temporary password", "password", "", true, false, "password")}</div></form>`,
      actions:
        '<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" data-save-staff>Save shopkeeper</button>',
    });
    $("[data-save-staff]").onclick = async (event) =>
      mutateModal(
        event.currentTarget,
        async () => {
          const body = formObject($("#staffForm"));
          return staff
            ? api.shopkeepers.update(staff.id, body)
            : api.shopkeepers.create(body);
        },
        "Shopkeeper saved",
      );
  }

  function showAdjustmentModal(selectedId) {
    const items = state.inventory;
    if (!items.length)
      return toast(
        "No products available",
        "Create a product before adjusting stock.",
      );
    openModal({
      title: "Stock adjustment",
      body: `<form id="stockForm"><div class="form-grid"><div class="form-group"><label>Product</label><select class="input" name="productId" required>${items.map((item) => `<option value="${item.productId}" ${item.productId === selectedId ? "selected" : ""}>${escapeHtml(item.name)} (${item.quantity} ${escapeHtml(item.unit)})</option>`).join("")}</select></div><div class="form-group"><label>Movement type</label><select class="input" name="movementType"><option value="RESTOCK">Restock</option><option value="INITIAL_STOCK">Initial stock</option><option value="ADJUSTMENT">Adjustment</option><option value="DAMAGE">Damage</option></select></div>${field("Quantity", "quantity", "", true, false, "number", "0.001")}${field("Reason", "reason", "", true)}</div><p class="muted" style="margin-top:14px">Damage is submitted as a negative change. Adjustment may be positive or negative.</p></form>`,
      actions:
        '<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" data-save-stock>Update stock</button>',
    });
    $("[data-save-stock]").onclick = async (event) =>
      mutateModal(
        event.currentTarget,
        async () => {
          const body = formObject($("#stockForm"));
          const productId = body.productId;
          delete body.productId;
          let quantity = Number(body.quantity);
          delete body.quantity;
          if (body.movementType === "DAMAGE") quantity = -Math.abs(quantity);
          body.quantityChange = String(quantity);
          return api.inventory.adjust(productId, body);
        },
        "Inventory updated",
      );
  }

  async function showMovements(productId) {
    const [balance, movements] = await Promise.all([
      api.inventory.get(productId),
      api.inventory.movements(productId),
    ]);
    openModal({
      title: `${balance.name} history`,
      body: movements.items.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th class="numeric">Change</th><th class="numeric">Before</th><th class="numeric">After</th><th>Reason</th></tr></thead><tbody>${movements.items.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${friendly(item.movementType)}</td><td class="numeric">${number(item.quantityChange) > 0 ? "+" : ""}${item.quantityChange}</td><td class="numeric">${item.quantityBefore}</td><td class="numeric">${item.quantityAfter}</td><td>${escapeHtml(item.reason || "—")}</td></tr>`).join("")}</tbody></table></div>`
        : emptyState(
            "No movement history",
            "Adjustments and sales will appear here.",
          ),
      actions: '<button class="btn btn-primary" data-close-modal>Done</button>',
    });
  }

  async function showSale(id) {
    const detail = await api.sales.get(id);
    const sale = detail.sale;
    const payment = detail.payments[0];
    const receipt = receiptMarkup(detail);
    $("#receiptPrint").innerHTML = receipt;
    const canVoid = sale.status === "completed" && !detail.returns.length;
    const canReturn = sale.status === "completed";
    openModal({
      title: "Sale details",
      body: `<dl class="detail-grid"><div><dt>Receipt</dt><dd>${escapeHtml(sale.receiptNumber)}</dd></div><div><dt>Status</dt><dd>${status(friendly(sale.status))}</dd></div><div><dt>Payment</dt><dd>${friendly(payment?.method)} · ${friendly(payment?.status)}</dd></div></dl><div style="margin-top:18px">${receipt}</div>${detail.returns.length ? `<div class="notice" style="margin-top:14px">${detail.returns.length} return record(s) attached to this sale.</div>` : ""}`,
      actions: `${canVoid ? '<button class="btn btn-danger" data-void-current>Void sale</button>' : ""}${canReturn ? '<button class="btn btn-secondary" data-return-current>Return items</button>' : ""}<button class="btn btn-secondary" data-print>${icon("print")}Print</button><button class="btn btn-primary" data-close-modal>Done</button>`,
    });
    $("[data-print]").onclick = () => window.print();
    $("[data-void-current]")?.addEventListener("click", () =>
      promptReason("Void sale", "Void eligible sale", (reason) =>
        api.sales.void(id, reason),
      ),
    );
    $("[data-return-current]")?.addEventListener("click", () =>
      showReturnModal(detail),
    );
  }

  function showReturnModal(detail) {
    const returned = new Map();
    detail.returns
      .flatMap((entry) => entry.items)
      .forEach((item) =>
        returned.set(
          item.saleItemId,
          number(returned.get(item.saleItemId)) + number(item.quantity),
        ),
      );
    const available = detail.items
      .map((item) => ({
        ...item,
        remaining: number(item.quantity) - number(returned.get(item.id)),
      }))
      .filter((item) => item.remaining > 0);
    openModal({
      title: "Return items",
      body: `<form id="returnForm"><div class="stock-list">${available.length ? available.map((item) => `<label class="stock-item"><input type="checkbox" name="selected" value="${item.id}"><div class="stock-copy"><strong>${escapeHtml(item.productName)}</strong><span>Returnable: ${item.remaining} · ${money(number(item.unitPrice))}</span></div><input class="input" style="width:90px" type="number" min="0.001" max="${item.remaining}" step="0.001" name="quantity-${item.id}" value="1"></label>`).join("") : '<p class="muted">All quantities have already been returned.</p>'}</div><div class="form-group" style="margin-top:14px"><label>Reason</label><textarea class="textarea" name="reason" required></textarea></div></form>`,
      actions:
        '<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-danger" data-submit-return>Process return</button>',
    });
    $("[data-submit-return]").onclick = async (event) =>
      mutateModal(
        event.currentTarget,
        async () => {
          const form = $("#returnForm");
          const selected = $$('input[name="selected"]:checked', form);
          if (!selected.length) throw new Error("Select at least one item.");
          const items = selected.map((checkbox) => ({
            saleItemId: checkbox.value,
            quantity: form.elements[`quantity-${checkbox.value}`].value,
          }));
          return api.sales.returnItems(
            detail.sale.id,
            items,
            form.elements.reason.value,
          );
        },
        "Return processed",
      );
  }

  function confirmMutation(title, description, label, operation) {
    openModal({
      title,
      small: true,
      body: `<p>${description}</p>`,
      actions: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-danger" data-confirm>${label}</button>`,
    });
    $("[data-confirm]").onclick = (event) =>
      mutateModal(event.currentTarget, operation, `${label} completed`);
  }

  function promptReason(title, label, operation) {
    openModal({
      title,
      small: true,
      body: `<form id="reasonForm"><div class="form-group"><label>Reason</label><textarea class="textarea" name="reason" minlength="3" required></textarea></div></form>`,
      actions: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-danger" data-reason-submit>${label}</button>`,
    });
    $("[data-reason-submit]").onclick = (event) =>
      mutateModal(
        event.currentTarget,
        () => operation($("#reasonForm").elements.reason.value),
        `${label} completed`,
      );
  }

  async function mutateModal(button, operation, successMessage) {
    const form = button.closest(".modal")?.querySelector("form");
    if (form && !form.reportValidity()) return;
    const original = button.textContent;
    setButtonLoading(button, true, "Saving…");
    try {
      await operation();
      closeModal();
      toast(successMessage);
      await renderRoute();
    } catch (error) {
      toast("Unable to complete action", error.message);
      setButtonLoading(button, false, original);
    }
  }

  async function saveShop(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    setButtonLoading(button, true, "Saving…");
    try {
      state.shop = await api.shop.update(formObject(event.currentTarget));
      toast("Shop settings saved");
    } catch (error) {
      toast("Unable to save settings", error.message);
    } finally {
      setButtonLoading(button, false, "Save changes");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    setButtonLoading(button, true, "Saving…");
    try {
      const body = formObject(event.currentTarget);
      delete body.email;
      state.profile = await api.profile.update(body);
      updateIdentity();
      toast("Profile saved");
    } catch (error) {
      toast("Unable to save profile", error.message);
    } finally {
      setButtonLoading(button, false, "Save changes");
    }
  }

  async function sendReport(button) {
    const original = button.textContent;
    setButtonLoading(button, true, "Sending…");
    try {
      const result = await api.reports.email(state.report.period?.key);
      toast(
        result.duplicate ? "Report already sent" : "Report sent",
        result.duplicate
          ? "The backend skipped a duplicate delivery."
          : "Delivered to the persisted owner email.",
      );
    } catch (error) {
      toast("Report could not be sent", error.message);
    } finally {
      setButtonLoading(button, false, original);
    }
  }

  function bindFilterForm(route, renderer) {
    $("#filterForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      renderer(formObject(event.currentTarget));
    });
  }
  function settingsNav(active) {
    return `<nav class="settings-nav"><a class="${active === "settings" ? "active" : ""}" href="#settings">Shop details</a><a class="${active === "profile" ? "active" : ""}" href="#profile">Personal profile</a></nav>`;
  }
  function field(
    label,
    name,
    value = "",
    required = false,
    readonly = false,
    type = "text",
    step = "",
  ) {
    return `<div class="form-group"><label for="field-${name}">${label}</label><input class="input ${readonly ? "readonly" : ""}" id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value ?? "")}" ${required ? "required" : ""} ${readonly ? "readonly" : ""} ${step ? `step="${step}"` : ""} ${type === "password" ? 'minlength="8" maxlength="128" pattern="(?=.*[A-Za-z])(?=.*\\d).{8,128}" title="Use at least 8 characters with a letter and a number"' : ""}></div>`;
  }
  function selectField(label, name, value, values) {
    return `<div class="form-group"><label for="field-${name}">${label}</label><select class="input" id="field-${name}" name="${name}">${values.map((option) => `<option value="${option}" ${option.toLowerCase() === String(value || "").toLowerCase() ? "selected" : ""}>${option}</option>`).join("")}</select></div>`;
  }
  function formObject(form) {
    return Object.fromEntries(
      [...new FormData(form)]
        .filter(([, value]) => value !== "")
        .map(([key, value]) => [
          key,
          typeof value === "string" ? value.trim() : value,
        ]),
    );
  }
  function setButtonLoading(button, loadingState, text) {
    button.disabled = loadingState;
    button.toggleAttribute("aria-busy", loadingState);
    button.textContent = text;
  }
  function friendly(value = "") {
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  }
  function firstName() {
    return (state.profile.fullName || "Owner").split(" ")[0];
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[character],
    );
  }
  function renderTopProducts(items) {
    if (!items.length)
      return '<p class="muted">No completed product sales for this period.</p>';
    const max = Math.max(
      ...items.map((item) =>
        number(
          item.sales || item.revenue || item.grossRevenue || item.quantitySold,
        ),
      ),
    );
    return items
      .slice(0, 8)
      .map((item) => {
        const monetary = item.sales ?? item.revenue ?? item.grossRevenue;
        const value = number(monetary ?? item.quantitySold);
        return `<div class="bar-row"><span>${escapeHtml(item.name || item.productName)}</span><div class="bar-track"><div class="bar-fill" style="width:${max ? (value / max) * 100 : 0}%"></div></div><strong>${monetary !== undefined ? money(value) : value}</strong></div>`;
      })
      .join("");
  }
  function renderBreakdown(items) {
    if (!items.length)
      return '<p class="muted">No completed payments for this period.</p>';
    const max = Math.max(
      ...items.map((item) => number(item.amount || item.total)),
    );
    return items
      .map((item) => {
        const value = number(item.amount || item.total);
        return `<div class="bar-row"><span>${friendly(item.method || item.paymentMethod)}</span><div class="bar-track"><div class="bar-fill" style="width:${max ? (value / max) * 100 : 0}%"></div></div><strong>${money(value)}</strong></div>`;
      })
      .join("");
  }
  function receiptMarkup(detail) {
    const { sale, items, payments = [], payment } = detail;
    const paid = payment || payments[0];
    return `<div class="receipt"><div class="receipt-head"><h2>${escapeHtml(state.shop?.name || "SHOPWISE")}</h2><small>${escapeHtml([state.shop?.address, state.shop?.city].filter(Boolean).join(", "))}</small></div><div>Receipt: ${escapeHtml(sale.receiptNumber)}</div><div>${formatDate(sale.createdAt)}</div><hr class="receipt-rule">${items.map((item) => `<div class="receipt-line"><span>${escapeHtml(item.productName)} × ${item.quantity}</span><span>${money(number(item.subtotal))}</span></div>`).join("")}<hr class="receipt-rule"><div class="receipt-line"><span>Subtotal</span><span>${money(number(sale.subtotal))}</span></div><div class="receipt-line"><span>Tax</span><span>${money(number(sale.taxAmount))}</span></div><div class="receipt-line receipt-total"><span>Total</span><span>${money(number(sale.totalAmount))}</span></div><hr class="receipt-rule"><div>Payment: ${friendly(paid?.method)}</div><div>Status: ${friendly(paid?.status)}</div><p style="text-align:center;margin-top:16px">Thank you.</p></div>`;
  }

  initialize();
})();
