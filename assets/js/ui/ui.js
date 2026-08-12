(function () {
  const $ = (s, c = document) => c.querySelector(s),
    $$ = (s, c = document) => [...c.querySelectorAll(s)];
  let lastFocus = null;
  function money(n) {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    })
      .format(n)
      .replace("KSh", "KES");
  }
  function status(value) {
    const map = {
      Active: "success",
      Completed: "success",
      Pending: "warning",
      Refunded: "warning",
      Failed: "danger",
      Archived: "muted",
      Inactive: "muted",
      "Low stock": "warning",
      "Out of stock": "danger",
    };
    return `<span class="status status-${map[value] || "muted"}">${value}</span>`;
  }
  function icon(id, cls = "") {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  }
  function toast(title, message = "") {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon("grid")}<div><strong>${title}</strong>${message ? `<p>${message}</p>` : ""}</div>`;
    $("#toastRegion")?.append(el);
    setTimeout(() => {
      el.classList.add("toast-exit");
      setTimeout(() => el.remove(), 180);
    }, 3000);
  }
  function closeModal() {
    const root = $("#modalRoot");
    if (!root) return;
    const activeModal = root.querySelector(".modal");
    activeModal?.classList.add("modal-exit");
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      if (!root.classList.contains("open")) root.innerHTML = "";
    }, 200);
    lastFocus?.focus();
  }
  function openModal({ title, body, actions = "", small = false }) {
    const root = $("#modalRoot");
    lastFocus = document.activeElement;
    root.innerHTML = `<section class="modal ${small ? "modal-sm" : ""}" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><header class="modal-header"><h2 id="modalTitle">${title}</h2><button class="btn btn-ghost btn-icon" data-close-modal aria-label="Close">${icon("x")}</button></header><div class="modal-body">${body}</div>${actions ? `<footer class="modal-footer">${actions}</footer>` : ""}</section>`;
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    root.querySelector("input,button,select,textarea")?.focus();
  }
  document.addEventListener("click", (e) => {
    if (
      e.target.matches("#modalRoot,[data-close-modal]") ||
      e.target.closest("[data-close-modal]")
    )
      closeModal();
    const toggle = e.target.closest("[data-menu-toggle]");
    if (toggle) {
      e.stopPropagation();
      const menu = toggle.parentElement.querySelector(".menu");
      $$(".menu.open")
        .filter((x) => x !== menu)
        .forEach((x) => x.classList.remove("open"));
      menu?.classList.toggle("open");
    } else if (!e.target.closest(".menu"))
      $$(".menu.open").forEach((x) => x.classList.remove("open"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab" && $("#modalRoot.open")) {
      const f = $$("button,input,select,textarea,a[href]", $("#modalRoot"));
      if (!f.length) return;
      const first = f[0],
        last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
  window.UI = { $, $$, money, status, icon, toast, openModal, closeModal };
})();
