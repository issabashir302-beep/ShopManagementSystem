(async function () {
  const form = document.getElementById("profileForm");
  const fields = {
    fullName: form.querySelectorAll("input")[0],
    username: form.querySelectorAll("input")[1],
    email: form.querySelectorAll("input")[2],
    phone: form.querySelectorAll("input")[3],
  };
  try {
    const identity = await AuthSession.hydrateIdentity();
    if (!["shopkeeper", "owner"].includes(identity.profile.userRole))
      return AuthSession.redirectToLogin(
        "This account cannot access Shopwise.",
      );
    fill(identity.profile);
  } catch (error) {
    if (error.status === 401 || error.status === 403)
      return AuthSession.redirectToLogin(error.message);
    showMessage("Unable to load profile", error.message, true);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const profile = await ShopwiseApi.profile.update({
        fullName: fields.fullName.value.trim(),
        username: fields.username.value.trim(),
        phone: fields.phone.value.trim(),
      });
      fill(profile);
      showMessage("Profile saved", "Your details are up to date.");
    } catch (error) {
      showMessage("Unable to save profile", error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Save changes";
    }
  });

  function fill(profile) {
    fields.fullName.value = profile.fullName || "";
    fields.username.value = profile.username || "";
    fields.email.value = profile.email || "";
    fields.phone.value = profile.phone || "";
    document.querySelector(".user-row h2").textContent =
      profile.fullName || "Shopwise user";
    document.querySelector(".user-row .muted").textContent =
      `${profile.userRole === "owner" ? "Owner" : "Shopkeeper"} · Shopwise`;
  }

  function showMessage(title, message, error = false) {
    const toast = document.createElement("div");
    toast.className = "toast";
    if (error) toast.style.background = "var(--color-danger)";
    toast.innerHTML = `<div><strong>${title}</strong><p>${message}</p></div>`;
    document.getElementById("toastRegion").append(toast);
    setTimeout(() => toast.remove(), 3000);
  }
})();
