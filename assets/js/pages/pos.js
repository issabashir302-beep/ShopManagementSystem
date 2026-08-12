(function () {
  const { $, $$, money, status, icon, toast, openModal, closeModal } = UI;
  const api = ShopwiseApi;
  const state = {
    profile: null,
    shop: null,
    products: [],
    sales: [],
    category: "All",
    query: "",
    payment: "cash",
    cart: new Map(),
    processing: false,
  };
  let stripe = null;
  let stripeElements = null;

  async function initialize() {
    bindStaticEvents();
    renderCart();
    renderLoadingProducts();
    try {
      const identity = await AuthSession.hydrateIdentity();
      if (!["shopkeeper", "owner"].includes(identity.profile.userRole))
        return AuthSession.redirectToLogin(
          "This account cannot access the POS.",
        );
      state.profile = identity.profile;
      state.shop = await api.shop.get();
      updateIdentity();
      await Promise.all([loadProducts(), loadRecentSales()]);
    } catch (error) {
      if (
        error.status === 401 ||
        error.status === 403 ||
        error.code === "SHOP_NOT_FOUND"
      )
        return AuthSession.redirectToLogin(error.message);
      renderProductError(error);
    }
  }

  async function loadProducts() {
    const [products, inventory] = await Promise.all([
      api.products.list({ status: "active", pageSize: 100 }),
      api.inventory.list({ pageSize: 100 }),
    ]);
    const balances = new Map(
      inventory.items.map((item) => [item.productId, item]),
    );
    state.products = products.items.map((product) => ({
      ...product,
      inventory: balances.get(product.id),
      stock: Number(balances.get(product.id)?.quantity || 0),
    }));
    renderCategories();
    renderProducts();
  }

  async function loadRecentSales() {
    const result = await api.sales.list({ limit: 20 });
    state.sales = result.items;
  }

  function updateIdentity() {
    const initials = (state.profile.fullName || "Cashier")
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    $(".pos-user .avatar").textContent = initials;
    const meta = $(".pos-user .user-meta");
    if (meta)
      meta.innerHTML = `<strong>${escapeHtml(state.profile.fullName)}</strong><span>${friendly(state.profile.userRole)}</span>`;
    $(".pos-header .brand-name").textContent = state.shop.name || "Shopwise";
    $(".pos-user a[aria-label='Sign out']").href = "#logout";
  }

  function renderLoadingProducts() {
    $("#productGrid").innerHTML = Array.from(
      { length: 8 },
      () =>
        '<div class="pos-product"><div class="skeleton" style="height:14px;width:75%"></div><div class="skeleton" style="height:10px;width:50%;margin-top:8px"></div></div>',
    ).join("");
    $("#productCount").textContent = "Loading products…";
  }

  function renderProductError(error) {
    $("#productCount").textContent = "Products unavailable";
    $("#productGrid").innerHTML =
      `<div class="empty-state"><div class="empty-icon">${icon("x")}</div><h3>Unable to load products</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-secondary" data-retry-products>Try again</button></div>`;
  }

  function renderCategories() {
    const categories = [
      "All",
      ...new Set(
        state.products.map((product) => product.category).filter(Boolean),
      ),
    ];
    $("#categoryTabs").innerHTML = categories
      .map(
        (category) =>
          `<button class="category-tab ${category === state.category ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`,
      )
      .join("");
  }

  function renderProducts() {
    const products = state.products.filter(
      (product) =>
        (state.category === "All" || product.category === state.category) &&
        `${product.name}${product.sku || ""}${product.barcode || ""}`
          .toLowerCase()
          .includes(state.query),
    );
    $("#productCount").textContent =
      `${products.length} product${products.length === 1 ? "" : "s"} available`;
    $("#productGrid").innerHTML = products.length
      ? products
          .map(
            (product) =>
              `<button class="pos-product ${product.stock <= 0 ? "out" : ""}" data-add="${product.id}" ${product.stock <= 0 ? "disabled" : ""}><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku || "No SKU")} · ${escapeHtml(product.category || "Uncategorised")}</small><div class="pos-product-footer"><div><div class="pos-product-price">${money(Number(product.sellingPrice))}</div><small class="${product.inventory?.isLowStock ? "warning" : ""}">${product.stock} ${escapeHtml(product.unit)} in stock</small></div><span class="add-mark" aria-hidden="true">+</span></div></button>`,
          )
          .join("")
      : `<div class="empty-state"><div class="empty-icon">${icon("search")}</div><h3>No products found</h3><p>Try another product name, SKU or barcode.</p></div>`;
  }

  function totals() {
    let total = 0;
    let count = 0;
    state.cart.forEach((quantity, id) => {
      const product = state.products.find((item) => item.id === id);
      if (product) {
        total += Number(product.sellingPrice) * quantity;
        count += quantity;
      }
    });
    return { total, count };
  }

  function renderCart() {
    const { total, count } = totals();
    $("#cartItemCount").textContent =
      `${count} ${count === 1 ? "item" : "items"}`;
    $("#mobileTotal").textContent = money(total);
    if (!count) {
      $("#cartLines").innerHTML =
        `<div class="cart-empty"><div><div class="empty-icon">${icon("receipt")}</div><h3>Your cart is empty</h3><p>Search or tap a product to begin a sale.</p></div></div>`;
      $("#cartFooter").innerHTML =
        '<button class="btn btn-primary btn-lg" style="width:100%" disabled>Charge KES 0</button>';
      return;
    }
    $("#cartLines").innerHTML = [...state.cart]
      .map(([id, quantity]) => {
        const product = state.products.find((item) => item.id === id);
        return `<div class="cart-line"><div class="cart-line-top"><div><strong>${escapeHtml(product.name)}</strong><br><small>${money(Number(product.sellingPrice))} each</small></div><strong>${money(Number(product.sellingPrice) * quantity)}</strong></div><div class="cart-line-bottom"><div class="qty-control"><button data-qty="${id}" data-delta="-1" aria-label="Decrease ${escapeHtml(product.name)}">−</button><span>${quantity}</span><button data-qty="${id}" data-delta="1" aria-label="Increase ${escapeHtml(product.name)}">+</button></div><button class="remove-line" data-remove="${id}">Remove</button></div></div>`;
      })
      .join("");
    $("#cartFooter").innerHTML =
      `<div class="totals"><div class="total-row"><span>Amount due</span><span>${money(total)}</span></div><div class="total-row"><span>Tax</span><span>Included</span></div><div class="total-row grand"><span>Total</span><span>${money(total)}</span></div></div><div class="payment-methods" role="group" aria-label="Payment method">${["cash", "mpesa", "card"].map((method) => `<button class="payment-method ${method === state.payment ? "active" : ""}" data-payment="${method}">${friendly(method)}</button>`).join("")}</div>${paymentContext(total)}<button class="btn btn-primary btn-lg" id="chargeBtn" style="width:100%" ${state.processing ? "disabled aria-busy=true" : ""}>${state.processing ? "Processing…" : `Charge ${money(total)}`}</button>`;
    $("#cashReceived")?.addEventListener("input", updateChange);
  }

  function paymentContext(total) {
    if (state.payment === "cash")
      return `<div class="payment-context"><div class="form-grid"><div class="form-group"><label for="cashReceived">Cash received</label><input class="input" id="cashReceived" type="number" min="${total}" value="${Math.ceil(total / 100) * 100}"></div><div class="form-group"><label>Change</label><div class="input readonly" id="cashChange">${money(Math.ceil(total / 100) * 100 - total)}</div></div></div></div>`;
    if (state.payment === "mpesa")
      return '<div class="payment-context"><strong>M-Pesa</strong><br><span class="muted">Checkout creates a pending payment. Hand over goods only after confirmation is available.</span></div>';
    return `<div class="payment-context"><strong>Secure card payment</strong><br><span class="muted">Stripe Elements will collect card details after the backend creates the sale and PaymentIntent.</span>${ShopwiseConfig.stripePublishableKey ? "" : '<div class="status status-warning" style="margin-top:7px">Stripe publishable key is not configured</div>'}</div>`;
  }

  function updateChange(event) {
    const change = Math.max(
      0,
      Number(event.target.value || 0) - totals().total,
    );
    $("#cashChange").textContent = money(change);
  }

  async function checkout() {
    if (state.processing || !state.cart.size) return;
    if (state.payment === "cash") {
      const cashInput = $("#cashReceived");
      if (Number(cashInput?.value || 0) < totals().total) {
        toast(
          "Insufficient cash received",
          "Cash received must cover the amount due.",
        );
        cashInput?.focus();
        return;
      }
    }
    if (state.payment === "card" && !ShopwiseConfig.stripePublishableKey)
      return toast(
        "Card payments unavailable",
        "Configure a Stripe test publishable key in api/config.js.",
      );
    state.processing = true;
    renderCart();
    const request = checkoutRequest();
    try {
      const result = await api.sales.checkout({
        clientRequestId: request.id,
        payment: { method: state.payment },
        items: [...state.cart].map(([productId, quantity]) => ({
          productId,
          quantity: String(quantity),
        })),
      });
      sessionStorage.removeItem("shopwise.checkoutRequest");
      // Checkout has already created the sale and deducted stock. Clear this
      // logical cart before provider follow-up so it cannot be sold twice.
      state.cart.clear();
      renderCart();
      await refreshAfterCheckout();
      if (state.payment === "card") {
        try {
          return await beginCardPayment(result);
        } catch (error) {
          showPendingSale(
            result.sale.id,
            "Card payment pending",
            "The sale was recorded, but card setup could not be completed. Refresh the sale before taking another action.",
          );
          toast("Unable to start card payment", error.message);
          return;
        }
      }
      showCheckoutResult(result);
    } catch (error) {
      if (
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      )
        sessionStorage.removeItem("shopwise.checkoutRequest");
      toast(checkoutErrorTitle(error), error.message);
    } finally {
      state.processing = false;
      renderCart();
    }
  }

  function checkoutRequest() {
    const fingerprint = JSON.stringify({
      payment: state.payment,
      items: [...state.cart].sort(),
    });
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("shopwise.checkoutRequest"),
      );
      if (stored?.fingerprint === fingerprint) return stored;
    } catch {
      /* create below */
    }
    const request = { id: crypto.randomUUID(), fingerprint };
    sessionStorage.setItem("shopwise.checkoutRequest", JSON.stringify(request));
    return request;
  }

  async function beginCardPayment(checkoutResult) {
    const intent = await api.payments.createStripeIntent(
      checkoutResult.sale.id,
    );
    stripe ||= window.Stripe(ShopwiseConfig.stripePublishableKey);
    stripeElements = stripe.elements({
      clientSecret: intent.clientSecret,
      appearance: {
        theme: "stripe",
        variables: { colorPrimary: "#145c49", borderRadius: "7px" },
      },
    });
    const paymentElement = stripeElements.create("payment");
    openModal({
      title: "Card payment",
      body: `<div id="stripePaymentElement" style="min-height:120px"></div><div id="stripeError" class="auth-error" role="alert" style="display:none;margin-top:12px"></div><p class="muted" style="margin-top:12px">The sale remains pending until the backend receives Stripe’s verified webhook.</p>`,
      actions:
        '<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" data-confirm-card>Confirm card payment</button>',
    });
    paymentElement.mount("#stripePaymentElement");
    $("[data-confirm-card]").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Confirming…";
      const { error } = await stripe.confirmPayment({
        elements: stripeElements,
        redirect: "if_required",
      });
      if (error) {
        const element = $("#stripeError");
        element.style.display = "block";
        element.textContent = error.message;
        button.disabled = false;
        button.textContent = "Confirm card payment";
        return;
      }
      button.textContent = "Waiting for confirmation…";
      await waitForPayment(checkoutResult.sale.id);
    };
  }

  async function waitForPayment(saleId) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const detail = await api.sales.get(saleId);
      const payment = detail.payments[0];
      if (payment.status === "completed") {
        showCheckoutResult({ sale: detail.sale, items: detail.items, payment });
        await refreshAfterCheckout();
        return;
      }
      if (payment.status === "failed") {
        closeModal();
        toast(
          "Card payment failed",
          "The sale remains recorded. Ask an owner to review it before retrying.",
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    closeModal();
    showPendingSale(
      saleId,
      "Card payment pending",
      "Confirmation has not reached Shopwise yet. Check the sale status again shortly.",
    );
  }

  function showCheckoutResult(result) {
    const pending = result.payment.status === "pending";
    const detail = {
      sale: result.sale,
      items: result.items,
      payments: [result.payment],
    };
    $("#receiptPrint").innerHTML = receiptMarkup(detail);
    openModal({
      title: pending ? "Payment pending" : "Payment complete",
      small: true,
      body: `<div style="text-align:center"><div class="empty-icon">${pending ? "…" : "✓"}</div><p class="muted">Receipt ${escapeHtml(result.sale.receiptNumber)}</p><div class="stat-value">${money(Number(result.sale.totalAmount))}</div>${pending ? '<div class="notice">Do not treat this payment as confirmed. Refresh its status before handing over goods.</div>' : ""}</div>`,
      actions: `<button class="btn btn-secondary" data-print-receipt>${icon("print")}Print receipt</button>${pending ? `<button class="btn btn-secondary" data-refresh-sale="${result.sale.id}">Refresh status</button>` : ""}<button class="btn btn-primary" data-new-sale>New sale</button>`,
    });
    $("[data-print-receipt]").onclick = () => window.print();
    $("[data-refresh-sale]")?.addEventListener("click", (event) =>
      refreshPendingSale(event.currentTarget.dataset.refreshSale),
    );
    $("[data-new-sale]").onclick = () => {
      state.cart.clear();
      closeModal();
      setCartOpen(false);
      renderCart();
      $("#productSearch").focus();
    };
  }

  function showPendingSale(saleId, title, description) {
    openModal({
      title,
      small: true,
      body: `<div class="notice">${description}</div>`,
      actions: `<button class="btn btn-secondary" data-refresh-sale="${saleId}">Refresh status</button><button class="btn btn-primary" data-close-modal>Done</button>`,
    });
    $("[data-refresh-sale]").onclick = (event) =>
      refreshPendingSale(event.currentTarget.dataset.refreshSale);
  }

  async function refreshPendingSale(saleId) {
    try {
      const detail = await api.sales.get(saleId);
      showCheckoutResult({
        sale: detail.sale,
        items: detail.items,
        payment: detail.payments[0],
      });
    } catch (error) {
      toast("Unable to refresh payment", error.message);
    }
  }

  async function refreshAfterCheckout() {
    await Promise.all([loadProducts(), loadRecentSales()]);
  }

  function recentSales() {
    openModal({
      title: "Recent sales",
      body: state.sales.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Receipt</th><th>Time</th><th class="numeric">Amount</th><th>Payment</th><th>Status</th></tr></thead><tbody>${state.sales.map((sale) => `<tr data-pos-sale="${sale.id}" tabindex="0"><td><strong>${escapeHtml(sale.receiptNumber)}</strong></td><td>${formatDate(sale.createdAt)}</td><td class="numeric">${money(Number(sale.totalAmount))}</td><td>${friendly(sale.paymentStatus)}</td><td>${status(friendly(sale.status))}</td></tr>`).join("")}</tbody></table></div>`
        : '<div class="empty-state"><h3>No recent sales</h3><p>Completed checkouts will appear here.</p></div>',
      actions:
        '<button class="btn btn-secondary" data-close-modal>Close</button>',
    });
  }

  async function showSale(id) {
    try {
      const detail = await api.sales.get(id);
      $("#receiptPrint").innerHTML = receiptMarkup(detail);
      openModal({
        title: detail.sale.receiptNumber,
        body: receiptMarkup(detail),
        actions: `<button class="btn btn-secondary" data-print-receipt>${icon("print")}Print</button><button class="btn btn-primary" data-close-modal>Done</button>`,
      });
      $("[data-print-receipt]").onclick = () => window.print();
    } catch (error) {
      toast("Unable to load sale", error.message);
    }
  }

  function bindStaticEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest('a[href="#logout"]')) {
        event.preventDefault();
        return AuthSession.logout();
      }
      if (event.target.closest("[data-retry-products]"))
        return loadProducts().catch(renderProductError);
      const add = event.target.closest("[data-add]");
      if (add) addProduct(add.dataset.add);
      const quantity = event.target.closest("[data-qty]");
      if (quantity)
        changeQuantity(quantity.dataset.qty, Number(quantity.dataset.delta));
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        state.cart.delete(remove.dataset.remove);
        invalidateCheckoutRequest();
        renderCart();
      }
      const method = event.target.closest("[data-payment]");
      if (method) {
        state.payment = method.dataset.payment;
        invalidateCheckoutRequest();
        renderCart();
      }
      const category = event.target.closest("[data-category]");
      if (category) {
        state.category = category.dataset.category;
        renderCategories();
        renderProducts();
      }
      if (event.target.closest("#chargeBtn")) checkout();
      const sale = event.target.closest("[data-pos-sale]");
      if (sale) showSale(sale.dataset.posSale);
    });
    $("#productSearch").addEventListener("input", (event) => {
      state.query = event.target.value.toLowerCase();
      renderProducts();
    });
    $("#productSearch").addEventListener("keydown", barcodeEnter);
    document.addEventListener("keydown", keyboardShortcuts);
    $("#clearCart").onclick = () => {
      state.cart.clear();
      invalidateCheckoutRequest();
      renderCart();
      toast("Cart cleared");
    };
    $("#recentSalesBtn").onclick = recentSales;
    $("#openCart").setAttribute("aria-controls", "cartPanel");
    $("#openCart").setAttribute("aria-expanded", "false");
    $("#openCart").onclick = () => setCartOpen(true);
    $("#closeCart").onclick = () => setCartOpen(false);
  }

  function addProduct(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    const next = Math.min((state.cart.get(id) || 0) + 1, product.stock);
    state.cart.set(id, next);
    invalidateCheckoutRequest();
    renderCart();
  }
  function changeQuantity(id, delta) {
    const product = state.products.find((item) => item.id === id);
    const next = Math.max(
      0,
      Math.min(product.stock, (state.cart.get(id) || 0) + delta),
    );
    next ? state.cart.set(id, next) : state.cart.delete(id);
    invalidateCheckoutRequest();
    renderCart();
  }
  function invalidateCheckoutRequest() {
    sessionStorage.removeItem("shopwise.checkoutRequest");
  }
  function barcodeEnter(event) {
    if (event.key !== "Enter") return;
    const match = state.products.find(
      (product) =>
        product.barcode?.toLowerCase() === state.query ||
        product.sku?.toLowerCase() === state.query,
    );
    if (!match || match.stock <= 0)
      return toast(
        "Product unavailable",
        "No in-stock product matches that code.",
      );
    addProduct(match.id);
    event.currentTarget.value = "";
    state.query = "";
    renderProducts();
    toast("Item added", match.name);
  }
  function keyboardShortcuts(event) {
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.target.matches("input,textarea,select")
    ) {
      event.preventDefault();
      $("#productSearch").focus();
    }
    if (event.key === "Escape" && $("#cartPanel").classList.contains("open"))
      setCartOpen(false);
  }
  function setCartOpen(open) {
    $("#cartPanel").classList.toggle("open", open);
    document.body.classList.toggle("navigation-locked", open);
    $("#openCart").setAttribute("aria-expanded", String(open));
  }
  function checkoutErrorTitle(error) {
    return error.code === "INSUFFICIENT_STOCK"
      ? "Insufficient stock"
      : error.status === 403
        ? "Access denied"
        : "Checkout failed";
  }
  function friendly(value = "") {
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  function formatDate(value) {
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
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
  function receiptMarkup(detail) {
    const payment = detail.payments?.[0] || detail.payment;
    return `<div class="receipt"><div class="receipt-head"><h2>${escapeHtml(state.shop?.name || "SHOPWISE")}</h2><small>${escapeHtml([state.shop?.address, state.shop?.city].filter(Boolean).join(", "))}</small></div><div>Receipt: ${escapeHtml(detail.sale.receiptNumber)}</div><div>${formatDate(detail.sale.createdAt)}</div><div>Cashier: ${escapeHtml(state.profile?.fullName || "")}</div><hr class="receipt-rule">${detail.items.map((item) => `<div class="receipt-line"><span>${escapeHtml(item.productName)} × ${item.quantity}</span><span>${money(Number(item.subtotal))}</span></div>`).join("")}<hr class="receipt-rule"><div class="receipt-line"><span>Subtotal</span><span>${money(Number(detail.sale.subtotal))}</span></div><div class="receipt-line"><span>Tax</span><span>${money(Number(detail.sale.taxAmount))}</span></div><div class="receipt-line receipt-total"><span>Total</span><span>${money(Number(detail.sale.totalAmount))}</span></div><hr class="receipt-rule"><div>Payment: ${friendly(payment?.method)}</div><div>Status: ${friendly(payment?.status)}</div><div>Reference: ${escapeHtml(payment?.providerReference || payment?.externalReference || "—")}</div><p style="text-align:center;margin-top:16px">Thank you.</p></div>`;
  }

  initialize();
})();
