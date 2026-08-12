(function () {
  const form = document.querySelector("form");
  const message = sessionStorage.getItem("shopwise.authMessage");

  if (message) {
    sessionStorage.removeItem("shopwise.authMessage");
    showMessage(message, "status");
  }

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password",
      );
      button.setAttribute("aria-pressed", String(!showing));
    });
  });

  const password = document.getElementById("password");
  const meter = document.querySelector(".password-meter span");
  password?.addEventListener("input", () => {
    if (!meter) return;
    const value = password.value;
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^\w]/.test(value)) score++;
    meter.style.width = `${score * 25}%`;
    meter.style.background =
      score < 2
        ? "var(--color-danger)"
        : score < 4
          ? "var(--color-warning)"
          : "var(--color-success)";
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    if (!form.checkValidity()) return form.reportValidity();

    const confirm = document.getElementById("confirm");
    if (confirm && password.value !== confirm.value) {
      confirm.setAttribute("aria-invalid", "true");
      confirm
        .closest(".form-group")
        .querySelector(".field-error")
        ?.classList.add("visible");
      return confirm.focus();
    }

    if (form.matches("[data-recovery]")) {
      showMessage(
        "Self-service recovery is not exposed by the current API. Ask the shop owner to request a password reset.",
        "error",
      );
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const original = button.textContent;
    setLoading(
      button,
      true,
      form.closest("body") && document.getElementById("name")
        ? "Creating account…"
        : "Signing in…",
    );
    try {
      let identity;
      if (document.getElementById("name")) {
        identity = await AuthSession.signup({
          fullName: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          password: password.value,
        });
        if (!identity?.profile) {
          showMessage(
            "Account created. Confirm your email, then sign in.",
            "status",
          );
          form.reset();
          return;
        }
      } else {
        identity = await AuthSession.login(
          document.getElementById("email").value.trim(),
          password.value,
        );
      }
      location.replace(
        identity.profile.userRole === "owner"
          ? ShopwiseConfig.ownerUrl
          : ShopwiseConfig.shopkeeperUrl,
      );
    } catch (error) {
      showMessage(friendlyAuthError(error), "error");
    } finally {
      setLoading(button, false, original);
    }
  });

  function setLoading(button, loading, text) {
    button.disabled = loading;
    button.toggleAttribute("aria-busy", loading);
    button.textContent = text;
  }

  function clearErrors() {
    form
      ?.querySelectorAll("[aria-invalid]")
      .forEach((input) => input.removeAttribute("aria-invalid"));
    form
      ?.querySelectorAll(".field-error")
      .forEach((error) => error.classList.remove("visible"));
    document.querySelector(".auth-feedback")?.remove();
  }

  function showMessage(text, type) {
    document.querySelector(".auth-feedback")?.remove();
    const element = document.createElement("div");
    element.className = `auth-success auth-feedback ${type === "error" ? "auth-error" : ""}`;
    element.setAttribute("role", type === "error" ? "alert" : "status");
    element.textContent = text;
    form?.prepend(element);
  }

  function friendlyAuthError(error) {
    const known = {
      ACCOUNT_ALREADY_EXISTS: "An account with this email already exists.",
      UNAUTHORIZED: "The email or password is incorrect.",
      VALIDATION_ERROR: error.message,
    };
    return (
      known[error.code] ||
      error.message ||
      "Unable to connect to Shopwise. Try again."
    );
  }
})();
