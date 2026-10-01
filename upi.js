/* Nakshatra UPI payments — no gateway, no KYC.
   Flow: deep-link / QR opens the payer's own UPI app with the owner's VPA +
   amount prefilled. Payer completes in their app, pastes the 12-digit UTR
   back here. Premium unlocks on-device after UTR validation. */

const NKPay = (() => {
  const cfg = () => window.NK_CONFIG;
  const isConfigured = () => cfg().UPI_ID && !cfg().UPI_ID.includes("REPLACE_WITH");
  const orderId = () => "NK" + Date.now().toString(36).toUpperCase();
  const upiUrl = (oid) =>
    "upi://pay?pa=" + encodeURIComponent(cfg().UPI_ID) +
    "&pn=" + encodeURIComponent(cfg().UPI_NAME) +
    "&tr=" + oid +
    "&am=" + cfg().PREMIUM_PRICE.toFixed(2) +
    "&cu=INR" +
    "&tn=" + encodeURIComponent(cfg().PREMIUM_LABEL);

  const hasPremium = () => {
    try { return !!JSON.parse(localStorage.getItem("nk_premium") || "null"); } catch { return false; }
  };
  const grantPremium = (oid, utr) => {
    localStorage.setItem("nk_premium", JSON.stringify({ orderId: oid, utr, ts: Date.now() }));
  };

  function render(el, onDone) {
    const price = cfg().PREMIUM_PRICE;
    if (!isConfigured()) {
      el.innerHTML = `
        <div class="pay-card">
          <div class="pay-title">Premium unlock</div>
          <p class="pay-note">UPI payments go live as soon as the app owner adds their receiving UPI ID.
          The button below is disabled until then.</p>
          <button class="btn-gold" disabled>Pay ₹${price} via UPI</button>
        </div>`;
      return;
    }
    const oid = orderId();
    const url = upiUrl(oid);
    el.innerHTML = `
      <div class="pay-card">
        <div class="pay-title">${cfg().PREMIUM_LABEL}</div>
        <div class="pay-amount">₹${price}<span> one-time</span></div>
        <div class="pay-order">Order ID <b>${oid}</b></div>
        <img class="pay-qr" alt="UPI QR code"
             src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=2a1e4f&bgcolor=ffffff&data=${encodeURIComponent(url)}">
        <p class="pay-note">Scan with any UPI app <b>or</b> tap below to open it directly.</p>
        <a class="btn-gold btn-block" href="${url}">Pay ₹${price} via UPI app</a>
        <div class="pay-divider"><span>after paying</span></div>
        <label class="pay-label" for="nk-utr">Enter the 12-digit UTR / Ref no. from your payment app</label>
        <div class="pay-utr-row">
          <input id="nk-utr" class="pay-input" inputmode="numeric" maxlength="12" placeholder="e.g. 428137294015">
          <button class="btn-gold" id="nk-verify">Verify</button>
        </div>
        <p class="pay-err" id="nk-pay-err" hidden></p>
        <p class="pay-note small">Find it in your UPI app under History → transaction details. Premium activates on this device instantly.</p>
      </div>`;
    el.querySelector("#nk-verify").addEventListener("click", () => {
      const v = el.querySelector("#nk-utr").value.replace(/\D/g, "");
      const err = el.querySelector("#nk-pay-err");
      if (!/^\d{12}$/.test(v)) {
        err.hidden = false;
        err.textContent = "UTR must be exactly 12 digits. Check your payment app's transaction history.";
        return;
      }
      grantPremium(oid, v);
      onDone && onDone();
    });
  }

  return { render, hasPremium, isConfigured, orderId };
})();
