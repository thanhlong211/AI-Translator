const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const runtimeConfig = window.AI_TRANSLATOR_ADMIN_CONFIG || {};
const defaultBackendUrl = String(
  runtimeConfig.backendUrl || "http://localhost:8080"
).trim().replace(/\/$/, "");
const allowBackendOverride = runtimeConfig.allowBackendOverride !== false;
const requireHttpsBackend = runtimeConfig.requireHttps === true;
const storedBackendUrl = allowBackendOverride
  ? sessionStorage.getItem("ait.admin.backend")
  : "";

const state = {
  backendUrl: storedBackendUrl || defaultBackendUrl,
  token: sessionStorage.getItem("ait.admin.token") || "",
  admin: JSON.parse(sessionStorage.getItem("ait.admin.user") || "null"),
  currentView: "dashboard",
  usersPage: 0,
  usersSize: 25,
  usersTotal: 0,
  plans: [],
  planSchema: null,
  prices: [],
  pricePlanFilter: "",
  licenses: [],
  licensePlanFilter: "",
  licenseStatusFilter: "",
  transactions: [],
  transactionStatusFilter: "",
  transactionPlanFilter: "",
  aiModelCosts: [],
  aiCostDashboard: null,
  aiRecentUsage: [],
  aiDashboardDays: Number(sessionStorage.getItem("ait.admin.aiCostDays") || "7"),
  aiCostProviderFilter: "",
  aiCostModelFilter: "",
  aiCostActiveFilter: "",
  adminTimeZone: "Asia/Ho_Chi_Minh",
  selectedAiDrilldown: null,
  marginDashboard: null,
  marginDays: Number(sessionStorage.getItem("ait.admin.marginDays") || "7"),
  fxRates: [],
  fxBaseFilter: "",
  fxQuoteFilter: "",
  fxActiveFilter: "",
  securityDashboard: null,
  securityDays: Number(sessionStorage.getItem("ait.admin.securityDays") || "7"),
  securitySeverity: "",
  securityOutcome: "",
  securityCategory: "",
  securityEventType: "",
  securityQuery: "",
  selectedSecurityEventId: null,
  auditDashboard: null,
  operationalHealth: null,
  errorDashboard: null,
  adminSafety: null,
  errorDays: Number(sessionStorage.getItem("ait.admin.errorDays") || "7"),
  errorStatus: "",
  errorSeverity: "",
  errorModule: "",
  errorCode: "",
  errorQuery: "",
  selectedErrorEventId: null,
  auditDays: Number(sessionStorage.getItem("ait.admin.auditDays") || "7"),
  auditCategory: "",
  auditAction: "",
  auditActor: "",
  auditTarget: "",
  auditQuery: "",
  selectedAuditId: null,
  selectedFxRateId: null,
  selectedUserId: null,
  selectedPlanCode: null,
  selectedPriceId: null,
  selectedLicenseId: null,
  selectedTransactionId: null,
  selectedAiCostId: null
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const fmtDate = (value) => {
  if (!value) return "Không giới hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: state.adminTimeZone || "Asia/Ho_Chi_Minh"
  }).format(date);
};

const fmtNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const fmtCompactNumber = (value) => {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  if (abs < 1000) return fmtNumber(number);
  if (abs < 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number / 1000)}K`;
  if (abs < 1_000_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number / 1_000_000)}M`;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number / 1_000_000_000)}B`;
};
const fmtPercent = (value) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value || 0))}%`;
const fmtCost = (value, currency = "USD") => {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  const maxDigits = abs > 0 && abs < 0.01 ? 8 : abs < 1 ? 6 : 4;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: maxDigits }).format(number)} ${String(currency || "USD").toUpperCase()}`;
};
const fmtLatency = (value) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ms`;

function toast(message, kind = "info") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast visible ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = "toast"; }, 3300);
}

function validateBackendUrl(value) {
  const clean = String(value || "").trim().replace(/\/$/, "");
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("Backend URL không hợp lệ.");
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Backend URL chỉ hỗ trợ HTTP/HTTPS.");
  }
  if (requireHttpsBackend && parsed.protocol !== "https:") {
    throw new Error("Production Admin chỉ được kết nối backend HTTPS.");
  }
  if (!allowBackendOverride && clean !== defaultBackendUrl) {
    throw new Error("Backend URL production đã bị khóa bởi deployment config.");
  }
  return clean;
}

function setSession(login) {
  state.token = login.accessToken;
  state.admin = login.user;
  sessionStorage.setItem("ait.admin.token", state.token);
  sessionStorage.setItem("ait.admin.user", JSON.stringify(state.admin));
  if (allowBackendOverride) {
    sessionStorage.setItem("ait.admin.backend", state.backendUrl);
  } else {
    sessionStorage.removeItem("ait.admin.backend");
  }
}

function clearSession() {
  state.token = "";
  state.admin = null;
  sessionStorage.removeItem("ait.admin.token");
  sessionStorage.removeItem("ait.admin.user");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${state.backendUrl}${path}`, { ...options, headers });
  let body = null;
  const text = await response.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = { message: text }; }
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/v1/admin/auth/login") {
      clearSession();
      showLogin("Phiên Admin đã hết hạn. Vui lòng đăng nhập lại.");
    }
    throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
  }
  return body;
}

function showLogin(message = "") {
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#backendUrl").value = state.backendUrl;
  $("#backendUrlField").classList.toggle("hidden", !allowBackendOverride);
  $("#backendUrl").readOnly = !allowBackendOverride;
  $("#loginError").textContent = message;
  $("#loginError").classList.toggle("hidden", !message);
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#adminIdentity").innerHTML = `<strong>${escapeHtml(state.admin?.email)}</strong><span>${escapeHtml(state.admin?.role)}</span>`;
  $("#backendStatus").textContent = state.backendUrl.replace(/^https?:\/\//, "");
  void loadView(state.currentView);
}

async function loadView(view) {
  state.currentView = view;
  $$(".nav-item[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.add("hidden"));
  $(`#${view}View`).classList.remove("hidden");
  const labels = { dashboard: "Tổng quan", users: "Người dùng", plans: "Plans & Features", pricing: "Pricing", licenses: "Licenses", transactions: "Transactions", aiCosts: "AI Costs", margin: "Revenue & Margin", security: "Security Events", audit: "Audit log", health: "Operational Health", errors: "Errors & Failed Jobs", safety: "Safety Controls" };
  $("#pageTitle").textContent = labels[view] || "Admin";
  try {
    if (view === "dashboard") await loadDashboard();
    if (view === "users") await loadUsers();
    if (view === "plans") await loadPlans();
    if (view === "pricing") await loadPricing();
    if (view === "licenses") await loadLicenses();
    if (view === "transactions") await loadTransactions();
    if (view === "aiCosts") await loadAiCosts();
    if (view === "margin") await loadMargin();
    if (view === "security") await loadSecurity();
    if (view === "audit") await loadAudit();
    if (view === "health") await loadOperationalHealth();
    if (view === "errors") await loadErrors();
    if (view === "safety") await loadSafety();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadDashboard() {
  const data = await api("/api/v1/admin/dashboard");
  const plans = Object.entries(data.planDistribution || {}).sort((a, b) => b[1] - a[1]);
  $("#dashboardView").innerHTML = `
    <div class="metric-grid">
      ${metric("Tổng người dùng", data.totalUsers, "accounts")}
      ${metric("User hoạt động", data.activeUsers, "ACTIVE")}
      ${metric("User bị khóa", data.suspendedUsers, "SUSPENDED")}
      ${metric("Phiên đang mở", data.activeSessions, "sessions")}
      ${metric("Lượt dịch hôm nay", data.usageToday, "UTC day")}
      ${metric("Lượt dịch tháng", data.usageMonth, "UTC month")}
    </div>
    <div class="dashboard-grid">
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">PLANS</span><h3>Phân bố gói hiện tại</h3></div></div>
        <div class="plan-bars">
          ${plans.length ? plans.map(([plan, total]) => `<div class="plan-bar-row"><strong>${escapeHtml(plan)}</strong><div class="bar-track"><i style="width:${Math.max(5, (total / Math.max(1, data.totalUsers)) * 100)}%"></i></div><span>${fmtNumber(total)}</span></div>`).join("") : '<div class="empty">Chưa có dữ liệu.</div>'}
        </div>
      </article>
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">RECENT</span><h3>Hoạt động Admin</h3></div><button class="text-button" data-open-audit>Xem tất cả</button></div>
        ${auditRows(data.recentAudit || [], true)}
      </article>
    </div>
    <article class="card roadmap-card">
      <span class="eyebrow">COMMERCIAL FOUNDATION</span>
      <h3>Admin core đã hoạt động</h3>
      <div class="roadmap-grid"><span class="done">✓ Users & access</span><span class="done">✓ 14.6 Plans & features</span><span class="done">✓ 14.7 Pricing / subscription / license</span><span class="done">✓ 14.7 Transactions</span><span class="done">✓ 14.8 AI cost & margin</span><span class="done">✓ 14.9.1 Security events</span><span class="done">✓ 14.9.2 Audit viewer</span><span class="done">✓ 14.9.3 Operational health</span><span class="done">✓ 14.9.4 Error monitoring</span><span class="done">✓ 14.9.5 Safety controls</span></div>
    </article>`;
  $("[data-open-audit]")?.addEventListener("click", () => void loadView("audit"));
}

function metric(label, value, hint) {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${fmtNumber(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}
function metricText(label, value, hint) {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong><small>${escapeHtml(hint)}</small></article>`;
}

const FEATURE_LABELS = {
  quickTranslate: "Quick Translate",
  studyMode: "Study Mode",
  mangaPanel: "Manga Panel",
  mangaSession: "Manga Session",
  continuousManga: "Continuous Manga",
  translationMemory: "Translation Memory",
  novelReaderTxt: "TXT Reader",
  novelReaderEpub: "EPUB Reader",
  pdfTextReader: "PDF Text Reader",
  pdfOcrReader: "PDF OCR Reader"
};

const LIMIT_LABELS = {
  monthlyTranslations: "Translations / tháng",
  mangaPagesPerDay: "Manga pages / ngày",
  continuousMangaPagesPerDay: "Continuous Manga pages / ngày",
  contextItems: "Context items",
  devices: "Devices"
};

const humanKey = (key, labels) => labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2");

const BILLING_LABELS = {
  MONTHLY: "Hàng tháng",
  YEARLY: "Hàng năm",
  LIFETIME: "Trọn đời"
};

const fmtMoneyMinor = (amount, currency) => {
  const value = Number(amount ?? 0);
  const code = String(currency || "VND").toUpperCase();
  try {
    const formatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: code });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(value / (10 ** fractionDigits));
  } catch {
    return `${fmtNumber(value)} ${code}`;
  }
};

const priceAvailability = (price) => {
  if (price.currentlyAvailable) return { label: "ON SALE", kind: "ok" };
  if (!price.active) return { label: "INACTIVE", kind: "warn" };
  if (!price.sellable) return { label: "HIDDEN", kind: "warn" };
  const now = Date.now();
  const starts = price.startsAt ? new Date(price.startsAt).getTime() : null;
  const ends = price.endsAt ? new Date(price.endsAt).getTime() : null;
  if (starts != null && starts > now) return { label: "SCHEDULED", kind: "info" };
  if (ends != null && ends <= now) return { label: "EXPIRED", kind: "warn" };
  return { label: "NOT LIVE", kind: "warn" };
};

const toLocalDateTimeValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const localDateTimeToIso = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày/giờ không hợp lệ.");
  return date.toISOString();
};

const subscriptionStatusKind = (status) => {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "TRIAL", "GRANDFATHERED"].includes(value)) return "ok";
  if (value === "SCHEDULED") return "info";
  return "warn";
};

const subscriptionRows = (items = []) => {
  if (!items.length) return '<div class="empty">User chưa có subscription.</div>';
  return `<div class="subscription-list">${items.map((sub) => {
    const editable = sub.source === "ADMIN" && sub.status !== "CANCELED";
    const canExtend = editable && !!sub.periodEnd;
    const price = sub.priceId == null
      ? "Không gắn price"
      : `#${sub.priceId} · ${escapeHtml(BILLING_LABELS[sub.priceBillingPeriod] || sub.priceBillingPeriod || "PRICE")}${sub.priceCurrency ? ` · ${escapeHtml(fmtMoneyMinor(sub.priceAmountMinor, sub.priceCurrency))}` : ""}`;
    return `<article class="subscription-card" data-subscription-id="${sub.id}">
      <div class="subscription-head"><div><span class="plan-pill">${escapeHtml(sub.planCode)}</span><strong>Subscription #${sub.id}</strong></div><span class="status-badge ${subscriptionStatusKind(sub.effectiveStatus)}">${escapeHtml(sub.effectiveStatus)}</span></div>
      <div class="subscription-meta">
        <span>Source <strong>${escapeHtml(sub.source)}</strong></span>
        <span>Status DB <strong>${escapeHtml(sub.status)}</strong></span>
        <span>Price <strong>${price}</strong></span>
        <span>Quota snapshot <strong>${fmtNumber(sub.monthlyTranslationLimit)}</strong></span>
        <span>Bắt đầu <strong>${fmtDate(sub.periodStart)}</strong></span>
        <span>Kết thúc <strong>${fmtDate(sub.periodEnd)}</strong></span>
      </div>
      ${sub.cancelReason ? `<div class="notice warn">Đã hủy: ${escapeHtml(sub.cancelReason)} · ${fmtDate(sub.canceledAt)}</div>` : ""}
      ${editable ? `<div class="subscription-actions">
        ${canExtend ? `<input type="datetime-local" data-subscription-end="${sub.id}" value="${escapeHtml(toLocalDateTimeValue(sub.periodEnd))}" />
        <button class="ghost" data-extend-subscription="${sub.id}">Gia hạn</button>` : '<span class="muted">Không giới hạn thời gian</span>'}
        <button class="danger-button" data-cancel-subscription="${sub.id}">Hủy subscription</button>
      </div>` : `<small class="muted">Source ${escapeHtml(sub.source)} chỉ xem tại đây; lifecycle được quản lý ở module tương ứng.</small>`}
    </article>`;
  }).join("")}</div>`;
};

async function ensurePlans() {
  if (!state.plans.length) state.plans = await api("/api/v1/admin/plans");
  return state.plans;
}

async function loadPricing() {
  await ensurePlans();
  const filter = state.pricePlanFilter || "";
  const query = filter ? `?planCode=${encodeURIComponent(filter)}` : "";
  state.prices = await api(`/api/v1/admin/prices${query}`);

  const activePlans = state.plans.filter((plan) => plan.active);
  const current = state.prices.filter((price) => price.currentlyAvailable).length;
  const scheduled = state.prices.filter((price) => price.active && price.sellable && price.startsAt && new Date(price.startsAt) > new Date()).length;
  const notLive = state.prices.filter((price) => !price.currentlyAvailable && priceAvailability(price).label !== "SCHEDULED").length;

  $("#pricingPlanFilter").innerHTML = `<option value="">Tất cả plan</option>${state.plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === filter ? "selected" : ""}>${escapeHtml(plan.displayName)} · ${escapeHtml(plan.code)}</option>`).join("")}`;
  $("#pricingMetrics").innerHTML = `
    ${metric("Price records", state.prices.length, filter || "all plans")}
    ${metric("Đang bán", current, "currently available")}
    ${metric("Đã lên lịch", scheduled, "future start")}
    ${metric("Không live", notLive, "inactive / hidden / expired")}`;

  $("#pricesTable").innerHTML = state.prices.length ? `
    <table><thead><tr><th>Plan</th><th>Chu kỳ</th><th>Giá bán</th><th>Niêm yết</th><th>Hiệu lực</th><th>Trạng thái</th></tr></thead>
    <tbody>${state.prices.map((price) => `
      <tr class="clickable" data-price-id="${price.id}">
        <td><strong>${escapeHtml(price.planDisplayName)}</strong><small>${escapeHtml(price.planCode)} · #${price.id}</small></td>
        <td><span class="period-pill">${escapeHtml(BILLING_LABELS[price.billingPeriod] || price.billingPeriod)}</span><small>${escapeHtml(price.currency)}</small></td>
        <td><strong class="money-value">${escapeHtml(fmtMoneyMinor(price.amountMinor, price.currency))}</strong><small>${fmtNumber(price.amountMinor)} minor units</small></td>
        <td>${price.compareAtAmountMinor == null ? '<span class="muted">—</span>' : `<span class="compare-price">${escapeHtml(fmtMoneyMinor(price.compareAtAmountMinor, price.currency))}</span>`}</td>
        <td><span>${price.startsAt ? fmtDate(price.startsAt) : "Ngay lập tức"}</span><small>→ ${price.endsAt ? fmtDate(price.endsAt) : "Không giới hạn"}</small></td>
        <td>${(() => { const status = priceAvailability(price); return `<span class="status-badge ${status.kind}">${status.label}</span>`; })()}</td>
      </tr>`).join("")}</tbody></table>`
    : '<div class="empty large">Chưa có cấu hình giá cho bộ lọc này.</div>';

  $$('[data-price-id]').forEach((row) => row.addEventListener("click", () => void openPrice(Number(row.dataset.priceId))));
  $("#createPriceButton").disabled = activePlans.length === 0;
}

async function openPrice(priceId) {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = priceId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải cấu hình giá...</div>';
  try {
    const [price] = await Promise.all([
      api(`/api/v1/admin/prices/${priceId}`),
      ensurePlans()
    ]);
    renderPriceDrawer(price, false);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

async function openCreatePrice() {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang chuẩn bị cấu hình giá...</div>';
  try {
    await ensurePlans();
    const preferred = state.pricePlanFilter && state.plans.some((plan) => plan.code === state.pricePlanFilter && plan.active)
      ? state.pricePlanFilter
      : state.plans.find((plan) => plan.active)?.code || "";
    renderPriceDrawer({
      id: null, planCode: preferred, billingPeriod: "MONTHLY", currency: "VND",
      amountMinor: 0, compareAtAmountMinor: null, active: true, sellable: false,
      startsAt: null, endsAt: null, currentlyAvailable: false
    }, true);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderPriceDrawer(price, isCreate) {
  $("#drawerTitle").textContent = isCreate ? "Tạo cấu hình giá" : `${price.planCode} · ${price.billingPeriod} · #${price.id}`;
  const planOptions = state.plans.map((plan) => `
    <option value="${escapeHtml(plan.code)}" ${plan.code === price.planCode ? "selected" : ""} ${!plan.active && plan.code !== price.planCode ? "disabled" : ""}>
      ${escapeHtml(plan.displayName)} · ${escapeHtml(plan.code)}${plan.active ? "" : " (disabled)"}
    </option>`).join("");

  $("#drawerBody").innerHTML = `
    <section class="drawer-section plan-section first">
      <div class="section-heading"><div><span class="eyebrow">PRICE DEFINITION</span><h3>${isCreate ? "Giá mới" : `Price #${price.id}`}</h3></div>${(() => { const status = priceAvailability(price); return `<span class="status-badge ${status.kind}">${status.label}</span>`; })()}</div>
      <div class="form-grid">
        <label><span>Plan</span><select id="pricePlanCode">${planOptions}</select></label>
        <label><span>Chu kỳ</span><select id="priceBillingPeriod">
          ${["MONTHLY", "YEARLY", "LIFETIME"].map((period) => `<option value="${period}" ${period === price.billingPeriod ? "selected" : ""}>${escapeHtml(BILLING_LABELS[period])} · ${period}</option>`).join("")}
        </select></label>
        <label><span>Currency</span><input id="priceCurrency" maxlength="3" value="${escapeHtml(price.currency || "VND")}" placeholder="VND" /></label>
        <label><span>Giá bán (minor unit)</span><input id="priceAmountMinor" type="number" min="0" step="1" value="${Number(price.amountMinor || 0)}" /></label>
        <label><span>Giá niêm yết (tùy chọn)</span><input id="priceCompareAt" type="number" min="0" step="1" value="${price.compareAtAmountMinor == null ? "" : Number(price.compareAtAmountMinor)}" placeholder="Để trống nếu không giảm giá" /></label>
        <div class="price-preview"><span>Xem trước</span><strong id="pricePreview">${escapeHtml(fmtMoneyMinor(price.amountMinor, price.currency))}</strong><small id="priceComparePreview">${price.compareAtAmountMinor == null ? "Không có giá niêm yết" : `Niêm yết ${escapeHtml(fmtMoneyMinor(price.compareAtAmountMinor, price.currency))}`}</small></div>
      </div>
      <div class="notice info"><code>amount_minor</code> lưu số nguyên nhỏ nhất của currency. VND/JPY nhập trực tiếp số tiền; USD/EUR nhập cent, ví dụ 19.99 USD = 1999.</div>
    </section>
    <section class="drawer-section plan-section">
      <div class="section-heading"><div><span class="eyebrow">SALE WINDOW</span><h3>Trạng thái & thời gian</h3></div><small class="muted">Backend chặn price đang bán bị overlap</small></div>
      <div class="form-grid">
        <label><span>Bắt đầu</span><input id="priceStartsAt" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(price.startsAt))}" /></label>
        <label><span>Kết thúc</span><input id="priceEndsAt" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(price.endsAt))}" /></label>
        <label class="toggle-field"><span>Active</span><span class="toggle-line"><input id="priceActive" type="checkbox" ${price.active ? "checked" : ""} /> Active</span></label>
        <label class="toggle-field"><span>Sellable</span><span class="toggle-line"><input id="priceSellable" type="checkbox" ${price.sellable ? "checked" : ""} /> Cho phép bán</span></label>
      </div>
      <div id="priceWindowHint" class="notice">${price.currentlyAvailable ? "Giá này hiện đang được public bán." : "Giá này hiện chưa được bán."}</div>
    </section>
    <section class="drawer-section plan-section">
      <label><span>Lý do ${isCreate ? "tạo" : "thay đổi"}</span><textarea id="priceReason" rows="2" maxlength="500" placeholder="Bắt buộc để ghi audit..."></textarea></label>
      <div class="action-row"><button id="savePrice" class="primary">${isCreate ? "Tạo giá" : "Lưu thay đổi"}</button></div>
      ${!isCreate ? `<small class="muted">Tạo: ${fmtDate(price.createdAt)} · cập nhật: ${fmtDate(price.updatedAt)}</small>` : ""}
    </section>`;

  const refreshPreview = () => {
    const currency = $("#priceCurrency").value.trim().toUpperCase() || "VND";
    const amount = Number($("#priceAmountMinor").value || 0);
    const compareRaw = $("#priceCompareAt").value.trim();
    $("#pricePreview").textContent = fmtMoneyMinor(amount, currency);
    $("#priceComparePreview").textContent = compareRaw ? `Niêm yết ${fmtMoneyMinor(Number(compareRaw), currency)}` : "Không có giá niêm yết";
    const active = $("#priceActive").checked;
    const sellable = $("#priceSellable").checked;
    $("#priceWindowHint").textContent = sellable && active
      ? "Giá được phép bán trong khoảng thời gian cấu hình; backend sẽ kiểm tra overlap khi lưu."
      : sellable && !active
        ? "Không hợp lệ: price sellable phải active."
        : "Price được lưu nhưng không xuất hiện trong catalog bán hàng.";
    $("#priceWindowHint").className = `notice ${sellable && !active ? "warn" : "info"}`;
  };
  ["#priceCurrency", "#priceAmountMinor", "#priceCompareAt", "#priceActive", "#priceSellable"].forEach((selector) => {
    $(selector).addEventListener("input", refreshPreview);
    $(selector).addEventListener("change", refreshPreview);
  });

  $("#savePrice").addEventListener("click", async () => {
    const planCode = $("#pricePlanCode").value;
    const billingPeriod = $("#priceBillingPeriod").value;
    const currency = $("#priceCurrency").value.trim().toUpperCase();
    const amountMinor = Number($("#priceAmountMinor").value);
    const compareRaw = $("#priceCompareAt").value.trim();
    const compareAtAmountMinor = compareRaw === "" ? null : Number(compareRaw);
    const active = $("#priceActive").checked;
    const sellable = $("#priceSellable").checked;
    const reason = $("#priceReason").value.trim();

    if (!planCode || !currency || !reason) {
      toast("Plan, currency và lý do là bắt buộc.", "error");
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      toast("Currency phải là mã ISO 3 ký tự, ví dụ VND hoặc USD.", "error");
      return;
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      toast("Giá bán phải là số nguyên không âm.", "error");
      return;
    }
    if (compareAtAmountMinor != null && (!Number.isSafeInteger(compareAtAmountMinor) || compareAtAmountMinor < amountMinor)) {
      toast("Giá niêm yết phải là số nguyên và lớn hơn hoặc bằng giá bán.", "error");
      return;
    }
    if (sellable && !active) {
      toast("Price đang bán phải ở trạng thái Active.", "error");
      return;
    }

    let startsAt;
    let endsAt;
    try {
      startsAt = localDateTimeToIso($("#priceStartsAt").value);
      endsAt = localDateTimeToIso($("#priceEndsAt").value);
    } catch (error) {
      toast(error.message, "error");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      toast("Ngày kết thúc phải sau ngày bắt đầu.", "error");
      return;
    }

    const body = { planCode, billingPeriod, currency, amountMinor, compareAtAmountMinor, active, sellable, startsAt, endsAt, reason };
    try {
      const saved = await api(isCreate ? "/api/v1/admin/prices" : `/api/v1/admin/prices/${price.id}`, {
        method: isCreate ? "POST" : "PUT",
        body: JSON.stringify(body)
      });
      toast(isCreate ? `Đã tạo price #${saved.id}.` : `Đã cập nhật price #${saved.id}.`, "success");
      closeDrawer();
      await loadPricing();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}


const LICENSE_DURATION_LABELS = {
  MONTHLY: "1 tháng",
  YEARLY: "1 năm",
  LIFETIME: "Lifetime",
  LEGACY_EXPIRY: "Legacy expiry"
};

const licenseAvailability = (license) => {
  if (license.status !== "AVAILABLE") return { label: "DISABLED", kind: "warn" };
  const now = Date.now();
  const starts = license.startsAt ? new Date(license.startsAt).getTime() : null;
  const expires = license.expiresAt ? new Date(license.expiresAt).getTime() : null;
  if (starts != null && starts > now) return { label: "SCHEDULED", kind: "info" };
  if (expires != null && expires <= now) return { label: "EXPIRED", kind: "warn" };
  if (Number(license.activationCount || 0) >= Number(license.maxActivations || 0)) return { label: "FULL", kind: "warn" };
  return { label: "AVAILABLE", kind: "ok" };
};

async function loadLicenses() {
  await ensurePlans();
  const params = new URLSearchParams();
  if (state.licensePlanFilter) params.set("planCode", state.licensePlanFilter);
  if (state.licenseStatusFilter) params.set("status", state.licenseStatusFilter);
  const query = params.toString() ? `?${params.toString()}` : "";
  state.licenses = await api(`/api/v1/admin/licenses${query}`);

  $("#licensePlanFilter").innerHTML = `<option value="">Tất cả plan</option>${state.plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === state.licensePlanFilter ? "selected" : ""}>${escapeHtml(plan.displayName)} · ${escapeHtml(plan.code)}</option>`).join("")}`;
  $("#licenseStatusFilter").value = state.licenseStatusFilter;

  const activeCount = state.licenses.filter((license) => licenseAvailability(license).label === "AVAILABLE").length;
  const totalCapacity = state.licenses.reduce((sum, license) => sum + Number(license.maxActivations || 0), 0);
  const used = state.licenses.reduce((sum, license) => sum + Number(license.activationCount || 0), 0);
  const disabled = state.licenses.filter((license) => license.status === "DISABLED").length;
  $("#licenseMetrics").innerHTML = `
    ${metric("License records", state.licenses.length, state.licensePlanFilter || "all plans")}
    ${metric("Có thể kích hoạt", activeCount, "available now")}
    ${metric("Activations", used, `capacity ${fmtNumber(totalCapacity)}`)}
    ${metric("Disabled", disabled, "future activation blocked")}`;

  $("#licensesTable").innerHTML = state.licenses.length ? `
    <table><thead><tr><th>License</th><th>Plan</th><th>Thời hạn</th><th>Activation</th><th>Redeem window</th><th>Trạng thái</th></tr></thead>
    <tbody>${state.licenses.map((license) => {
      const status = licenseAvailability(license);
      return `<tr class="clickable" data-license-id="${license.id}">
        <td><strong>License #${license.id}</strong><small>${escapeHtml(license.keyHint || "legacy key")}</small></td>
        <td><span class="plan-pill">${escapeHtml(license.planCode)}</span></td>
        <td><span class="period-pill">${escapeHtml(LICENSE_DURATION_LABELS[license.durationType] || license.durationType)}</span></td>
        <td><strong>${fmtNumber(license.activationCount)} / ${fmtNumber(license.maxActivations)}</strong><small>active users</small></td>
        <td><span>${license.startsAt ? fmtDate(license.startsAt) : "Ngay lập tức"}</span><small>→ ${license.expiresAt ? fmtDate(license.expiresAt) : "Không giới hạn"}</small></td>
        <td><span class="status-badge ${status.kind}">${status.label}</span></td>
      </tr>`;
    }).join("")}</tbody></table>` : '<div class="empty large">Chưa có license cho bộ lọc này.</div>';

  $$('[data-license-id]').forEach((row) => row.addEventListener("click", () => void openLicense(Number(row.dataset.licenseId))));
  $("#createLicenseButton").disabled = !state.plans.some((plan) => plan.active);
}

async function openLicense(licenseId) {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = licenseId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải license...</div>';
  try {
    const [license] = await Promise.all([api(`/api/v1/admin/licenses/${licenseId}`), ensurePlans()]);
    renderLicenseDrawer(license, false);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

async function openCreateLicense() {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang chuẩn bị license...</div>';
  try {
    await ensurePlans();
    const preferred = state.licensePlanFilter && state.plans.some((plan) => plan.code === state.licensePlanFilter && plan.active)
      ? state.licensePlanFilter
      : state.plans.find((plan) => plan.active)?.code || "";
    renderLicenseDrawer({
      id: null,
      planCode: preferred,
      status: "AVAILABLE",
      durationType: "MONTHLY",
      maxActivations: 1,
      activationCount: 0,
      startsAt: null,
      expiresAt: null,
      note: "",
      issuedKey: null,
      activations: []
    }, true);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function licenseActivationRows(license) {
  const rows = license.activations || [];
  if (!rows.length) return '<div class="empty">License chưa được kích hoạt.</div>';
  return `<div class="license-activation-list">${rows.map((activation) => `
    <article class="license-activation-card">
      <div class="subscription-head"><div><strong>${escapeHtml(activation.userEmail || `User #${activation.userId}`)}</strong><span class="identity-pill">#${activation.userId}</span></div><span class="status-badge ${activation.status === "ACTIVE" ? "ok" : "warn"}">${escapeHtml(activation.status)}</span></div>
      <div class="subscription-meta">
        <span>Device <strong>${escapeHtml(activation.deviceId || "Không ghi nhận")}</strong></span>
        <span>Activated <strong>${fmtDate(activation.activatedAt)}</strong></span>
        <span>Subscription <strong>${activation.latestSubscriptionId ? `#${activation.latestSubscriptionId}` : "—"}</strong></span>
        <span>Revoked <strong>${activation.revokedAt ? fmtDate(activation.revokedAt) : "—"}</strong></span>
      </div>
      ${activation.revokeReason ? `<div class="notice warn">${escapeHtml(activation.revokeReason)}${activation.revokedByEmail ? ` · ${escapeHtml(activation.revokedByEmail)}` : ""}</div>` : ""}
      ${activation.status === "ACTIVE" ? `<div class="action-row"><button class="danger-button" data-revoke-license-activation="${activation.id}">Revoke activation</button></div>` : ""}
    </article>`).join("")}</div>`;
}

function renderLicenseDrawer(license, isCreate) {
  const status = licenseAvailability(license);
  $("#drawerTitle").textContent = isCreate ? "Tạo license" : `License #${license.id} · ${license.planCode}`;
  const planOptions = state.plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === license.planCode ? "selected" : ""} ${!plan.active && plan.code !== license.planCode ? "disabled" : ""}>${escapeHtml(plan.displayName)} · ${escapeHtml(plan.code)}${plan.active ? "" : " (disabled)"}</option>`).join("");

  $("#drawerBody").innerHTML = `
    ${license.issuedKey ? `<section class="issued-key-card"><span class="eyebrow">CHỈ HIỂN THỊ MỘT LẦN</span><h3>License key đã tạo</h3><code id="issuedLicenseKey">${escapeHtml(license.issuedKey)}</code><div class="action-row"><button id="copyIssuedLicense" class="primary">Copy key</button></div><small>Backend chỉ lưu SHA-256 hash. Hãy lưu key trước khi đóng drawer.</small></section>` : ""}
    <section class="drawer-section plan-section ${license.issuedKey ? "" : "first"}">
      <div class="section-heading"><div><span class="eyebrow">LICENSE DEFINITION</span><h3>${isCreate ? "Key mới" : `#${license.id} · ${escapeHtml(license.keyHint || "legacy")}`}</h3></div><span class="status-badge ${status.kind}">${status.label}</span></div>
      <div class="form-grid">
        <label><span>Plan</span><select id="licensePlanCode" ${isCreate ? "" : "disabled"}>${planOptions}</select></label>
        <label><span>Thời hạn entitlement</span><select id="licenseDuration" ${isCreate ? "" : "disabled"}>${["MONTHLY", "YEARLY", "LIFETIME"].map((duration) => `<option value="${duration}" ${duration === license.durationType ? "selected" : ""}>${escapeHtml(LICENSE_DURATION_LABELS[duration])} · ${duration}</option>`).join("")}${!isCreate && license.durationType === "LEGACY_EXPIRY" ? '<option value="LEGACY_EXPIRY" selected>Legacy expiry</option>' : ""}</select></label>
        ${!isCreate ? `<label><span>Status key</span><select id="licenseStatus"><option value="AVAILABLE" ${license.status === "AVAILABLE" ? "selected" : ""}>AVAILABLE</option><option value="DISABLED" ${license.status === "DISABLED" ? "selected" : ""}>DISABLED</option></select></label>` : ""}
        <label><span>Max activations</span><input id="licenseMaxActivations" type="number" min="1" max="10000" step="1" value="${Number(license.maxActivations || 1)}" /></label>
        <label><span>Cho phép redeem từ</span><input id="licenseStartsAt" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(license.startsAt))}" /></label>
        <label><span>Hết hạn redeem</span><input id="licenseExpiresAt" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(license.expiresAt))}" /></label>
      </div>
      <div class="notice info">MONTHLY/YEARLY tính subscription từ thời điểm user kích hoạt. <strong>Hết hạn redeem</strong> chỉ khóa activation mới, không cắt subscription đã cấp.</div>
      <label><span>Ghi chú nội bộ</span><textarea id="licenseNote" rows="2" maxlength="500" placeholder="Đơn hàng, chiến dịch, khách hàng..."></textarea></label>
    </section>
    <section class="drawer-section plan-section">
      <label><span>Lý do ${isCreate ? "tạo" : "thay đổi"}</span><textarea id="licenseReason" rows="2" maxlength="500" placeholder="Bắt buộc để ghi audit..."></textarea></label>
      <div class="action-row"><button id="saveLicense" class="primary">${isCreate ? "Tạo license" : "Lưu license"}</button>${!isCreate && Number(license.activationCount || 0) > 0 ? '<button id="resetLicenseActivations" class="danger-button">Reset mọi activation</button>' : ""}</div>
      ${!isCreate ? `<small class="muted">Tạo: ${fmtDate(license.createdAt)}${license.createdByEmail ? ` bởi ${escapeHtml(license.createdByEmail)}` : ""} · cập nhật: ${fmtDate(license.updatedAt)}</small>` : ""}
    </section>
    ${!isCreate ? `<section class="drawer-section plan-section"><div class="section-heading"><div><span class="eyebrow">ACTIVATIONS</span><h3>${fmtNumber(license.activationCount)} / ${fmtNumber(license.maxActivations)} đang hoạt động</h3></div></div>${licenseActivationRows(license)}</section>` : ""}`;

  $("#licenseNote").value = license.note || "";
  if (license.issuedKey) {
    $("#copyIssuedLicense")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(license.issuedKey);
        toast("Đã copy license key.", "success");
      } catch {
        toast("Không thể copy tự động. Hãy copy key thủ công.", "error");
      }
    });
  }

  $("#saveLicense").addEventListener("click", async () => {
    const reason = $("#licenseReason").value.trim();
    const maxActivations = Number($("#licenseMaxActivations").value);
    if (!reason) { toast("Lý do thao tác là bắt buộc.", "error"); return; }
    if (!Number.isInteger(maxActivations) || maxActivations < 1 || maxActivations > 10000) { toast("Max activations phải từ 1 đến 10000.", "error"); return; }
    let startsAt;
    let expiresAt;
    try {
      startsAt = localDateTimeToIso($("#licenseStartsAt").value);
      expiresAt = localDateTimeToIso($("#licenseExpiresAt").value);
    } catch (error) { toast(error.message, "error"); return; }
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) { toast("Hạn redeem phải sau ngày bắt đầu.", "error"); return; }

    const body = isCreate
      ? { planCode: $("#licensePlanCode").value, durationType: $("#licenseDuration").value, maxActivations, startsAt, expiresAt, note: $("#licenseNote").value.trim(), reason }
      : { status: $("#licenseStatus").value, maxActivations, startsAt, expiresAt, note: $("#licenseNote").value.trim(), reason };
    try {
      const saved = await api(isCreate ? "/api/v1/admin/licenses" : `/api/v1/admin/licenses/${license.id}`, { method: isCreate ? "POST" : "PUT", body: JSON.stringify(body) });
      toast(isCreate ? `Đã tạo license #${saved.id}.` : `Đã cập nhật license #${saved.id}.`, "success");
      if (isCreate) {
        state.selectedLicenseId = saved.id;
        renderLicenseDrawer(saved, false);
      } else {
        renderLicenseDrawer(saved, false);
      }
      await loadLicenses();
    } catch (error) { toast(error.message, "error"); }
  });

  $$('[data-revoke-license-activation]').forEach((button) => button.addEventListener("click", async () => {
    const activationId = Number(button.dataset.revokeLicenseActivation);
    const reason = window.prompt("Lý do revoke activation:", "Revoke license activation")?.trim();
    if (!reason) return;
    if (!window.confirm(`Revoke activation #${activationId}? Subscription LICENSE của user sẽ bị hủy.`)) return;
    try {
      const saved = await api(`/api/v1/admin/licenses/${license.id}/activations/${activationId}/revoke`, { method: "POST", body: JSON.stringify({ reason }) });
      toast(`Đã revoke activation #${activationId}.`, "success");
      renderLicenseDrawer(saved, false);
      await loadLicenses();
    } catch (error) { toast(error.message, "error"); }
  }));

  $("#resetLicenseActivations")?.addEventListener("click", async () => {
    const reason = window.prompt("Lý do reset tất cả activation:", "Reset license activations")?.trim();
    if (!reason) return;
    if (!window.confirm(`Reset toàn bộ activation của license #${license.id}? Tất cả subscription LICENSE liên quan sẽ bị hủy.`)) return;
    try {
      const saved = await api(`/api/v1/admin/licenses/${license.id}/activations/reset`, { method: "POST", body: JSON.stringify({ reason }) });
      toast(`Đã reset activation của license #${license.id}.`, "success");
      renderLicenseDrawer(saved, false);
      await loadLicenses();
    } catch (error) { toast(error.message, "error"); }
  });
}

async function ensurePlanSchema() {
  if (!state.planSchema) state.planSchema = await api("/api/v1/admin/plan-schema");
  return state.planSchema;
}


const transactionStatusKind = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "SUCCEEDED") return "ok";
  if (value === "PENDING") return "info";
  return "warn";
};

async function loadTransactions() {
  await ensurePlans();
  const params = new URLSearchParams();
  if (state.transactionStatusFilter) params.set("status", state.transactionStatusFilter);
  if (state.transactionPlanFilter) params.set("planCode", state.transactionPlanFilter);
  params.set("limit", "300");
  state.transactions = await api(`/api/v1/admin/transactions?${params.toString()}`);

  $("#transactionStatusFilter").value = state.transactionStatusFilter;
  $("#transactionPlanFilter").innerHTML = `<option value="">Tất cả plan</option>${state.plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === state.transactionPlanFilter ? "selected" : ""}>${escapeHtml(plan.displayName)} · ${escapeHtml(plan.code)}</option>`).join("")}`;
  const pending = state.transactions.filter((tx) => tx.status === "PENDING").length;
  const succeeded = state.transactions.filter((tx) => tx.status === "SUCCEEDED").length;
  const refunded = state.transactions.filter((tx) => tx.status === "REFUNDED").length;
  $("#transactionMetrics").innerHTML = `
    ${metric("Transactions", state.transactions.length, state.transactionPlanFilter || "all plans")}
    ${metric("Pending", pending, "awaiting settlement")}
    ${metric("Succeeded", succeeded, "payment granted")}
    ${metric("Refunded", refunded, "full refunds")}`;

  $("#createTransactionButton").disabled = state.admin?.role !== "SUPER_ADMIN";
  $("#transactionsTable").innerHTML = state.transactions.length ? `
    <table><thead><tr><th>Transaction</th><th>User</th><th>Plan / Price</th><th>Amount</th><th>Provider</th><th>Status</th><th>Created</th></tr></thead>
    <tbody>${state.transactions.map((tx) => `<tr class="clickable" data-transaction-id="${tx.id}">
      <td><strong>#${tx.id}</strong><small>${escapeHtml(tx.publicId)}</small></td>
      <td><strong>${escapeHtml(tx.userEmail)}</strong><small>User #${tx.userId}</small></td>
      <td><span class="plan-pill">${escapeHtml(tx.planCode)}</span><small>${escapeHtml(BILLING_LABELS[tx.billingPeriod] || tx.billingPeriod)} · Price ${tx.priceId == null ? "—" : `#${tx.priceId}`}</small></td>
      <td><strong class="money-value">${escapeHtml(fmtMoneyMinor(tx.amountMinor, tx.currency))}</strong>${Number(tx.refundedAmountMinor || 0) > 0 ? `<small>Refund ${escapeHtml(fmtMoneyMinor(tx.refundedAmountMinor, tx.currency))}</small>` : `<small>${escapeHtml(tx.currency)}</small>`}</td>
      <td><strong>${escapeHtml(tx.provider)}</strong><small>${escapeHtml(tx.providerReference || "—")}</small></td>
      <td><span class="status-badge ${transactionStatusKind(tx.status)}">${escapeHtml(tx.status)}</span>${tx.subscriptionId ? `<small>Sub #${tx.subscriptionId}</small>` : ""}${tx.paidAt ? `<small>Revenue: ${escapeHtml(tx.revenueStatus || "PENDING")}</small>` : ""}</td>
      <td>${fmtDate(tx.createdAt)}</td>
    </tr>`).join("")}</tbody></table>` : '<div class="empty large">Chưa có payment transaction.</div>';
  $$('[data-transaction-id]').forEach((row) => row.addEventListener("click", () => void openTransaction(Number(row.dataset.transactionId))));
}

async function openTransaction(transactionId) {
  state.selectedTransactionId = transactionId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải transaction...</div>';
  try {
    const transaction = await api(`/api/v1/admin/transactions/${transactionId}`);
    renderTransactionDrawer(transaction);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

async function openCreateTransaction() {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được tạo manual transaction.", "error");
    return;
  }
  state.selectedTransactionId = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải price đang bán...</div>';
  try {
    const prices = (await api("/api/v1/admin/prices")).filter((price) => price.currentlyAvailable);
    $("#drawerTitle").textContent = "Tạo manual transaction";
    $("#drawerBody").innerHTML = `
      <section class="drawer-section first">
        <div class="section-heading"><div><span class="eyebrow">PAYMENT FOUNDATION</span><h3>Manual transaction</h3></div><span class="status-badge info">PENDING</span></div>
        <div class="notice info">Dùng để test lifecycle trước khi tích hợp gateway thật. Amount/plan/currency được snapshot từ price đang ON SALE và không nhập tay.</div>
        <div class="form-grid">
          <label><span>User ID</span><input id="transactionUserId" type="number" min="1" step="1" placeholder="Ví dụ 42" /></label>
          <label><span>Price</span><select id="transactionPriceId">${prices.map((price) => `<option value="${price.id}">${escapeHtml(price.planCode)} · ${escapeHtml(BILLING_LABELS[price.billingPeriod] || price.billingPeriod)} · ${escapeHtml(fmtMoneyMinor(price.amountMinor, price.currency))} · #${price.id}</option>`).join("")}</select></label>
          <label class="full"><span>Provider reference (tùy chọn)</span><input id="transactionProviderRef" maxlength="190" placeholder="Mã đối soát/manual reference" /></label>
          <label class="full"><span>Lý do / audit</span><textarea id="transactionReason" maxlength="500" placeholder="Ví dụ: test payment lifecycle 14.7.5"></textarea></label>
        </div>
        <div class="action-row"><button id="saveTransaction" class="primary" ${prices.length ? "" : "disabled"}>Tạo PENDING transaction</button></div>
      </section>`;
    if (!prices.length) $("#drawerBody").insertAdjacentHTML("afterbegin", '<div class="notice warn">Không có price ON SALE. Hãy mở bán một price trước.</div>');
    $("#saveTransaction")?.addEventListener("click", async () => {
      const userId = Number($("#transactionUserId").value);
      const priceId = Number($("#transactionPriceId").value);
      const reason = $("#transactionReason").value.trim();
      if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(priceId) || priceId <= 0 || !reason) {
        toast("User ID, price và lý do là bắt buộc.", "error"); return;
      }
      try {
        const created = await api("/api/v1/admin/transactions/manual", { method: "POST", body: JSON.stringify({ userId, priceId, providerReference: $("#transactionProviderRef").value.trim() || null, reason }) });
        toast(`Đã tạo transaction #${created.id}.`, "success");
        renderTransactionDrawer(created);
        await loadTransactions();
      } catch (error) { toast(error.message, "error"); }
    });
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderTransactionDrawer(tx) {
  state.selectedTransactionId = tx.id;
  $("#drawerTitle").textContent = `Transaction #${tx.id}`;
  const isSuperAdmin = state.admin?.role === "SUPER_ADMIN";
  const pending = tx.status === "PENDING";
  const succeeded = tx.status === "SUCCEEDED";
  $("#drawerBody").innerHTML = `
    <section class="drawer-section first">
      <div class="section-heading"><div><span class="eyebrow">PAYMENT TRANSACTION</span><h3>${escapeHtml(tx.publicId)}</h3></div><span class="status-badge ${transactionStatusKind(tx.status)}">${escapeHtml(tx.status)}</span></div>
      <div class="transaction-summary">
        <div><span>User</span><strong>${escapeHtml(tx.userEmail)}</strong><small>#${tx.userId}</small></div>
        <div><span>Plan</span><strong>${escapeHtml(tx.planCode)}</strong><small>${escapeHtml(BILLING_LABELS[tx.billingPeriod] || tx.billingPeriod)}</small></div>
        <div><span>Amount</span><strong>${escapeHtml(fmtMoneyMinor(tx.amountMinor, tx.currency))}</strong><small>${fmtNumber(tx.amountMinor)} minor units</small></div>
        <div><span>Provider</span><strong>${escapeHtml(tx.provider)}</strong><small>${escapeHtml(tx.providerReference || "—")}</small></div>
        <div><span>Price</span><strong>${tx.priceId == null ? "—" : `#${tx.priceId}`}</strong><small>snapshot at create</small></div>
        <div><span>Subscription</span><strong>${tx.subscriptionId == null ? "—" : `#${tx.subscriptionId}`}</strong><small>${tx.subscriptionId ? "source=PAYMENT" : "not granted"}</small></div>
      </div>
      ${tx.failureCode || tx.failureMessage ? `<div class="notice warn">${escapeHtml(tx.failureCode || "FAILED")}: ${escapeHtml(tx.failureMessage || "Không có chi tiết")}</div>` : ""}
      ${Number(tx.refundedAmountMinor || 0) > 0 ? `<div class="notice warn">Đã refund ${escapeHtml(fmtMoneyMinor(tx.refundedAmountMinor, tx.currency))} lúc ${fmtDate(tx.refundedAt)}.</div>` : ""}
      ${tx.paidAt ? `<div class="notice ${tx.revenueStatus === "NORMALIZED" ? "ok" : "warn"}"><strong>Revenue snapshot: ${escapeHtml(tx.revenueStatus || "PENDING")}</strong>${tx.revenueStatus === "NORMALIZED" ? ` · Gross ${escapeHtml(fmtCost(tx.grossAmountReporting, tx.reportingCurrency))} · Refund ${escapeHtml(fmtCost(tx.refundedAmountReporting, tx.reportingCurrency))} · Net ${escapeHtml(fmtCost(tx.netAmountReporting, tx.reportingCurrency))}${tx.fxRate ? ` · FX ${escapeHtml(String(tx.fxRate))}${tx.fxRateId ? ` (#${tx.fxRateId})` : " (implicit 1)"}` : ""}` : " · Hãy cấu hình FX đúng currency/time window rồi Backfill revenue trong Revenue & Margin."}</div>` : ""}
      <div class="compact-list"><div><strong>Created</strong><span>${fmtDate(tx.createdAt)}</span></div>${tx.paidAt ? `<div><strong>Paid</strong><span>${fmtDate(tx.paidAt)}</span></div>` : ""}${tx.failedAt ? `<div><strong>Failed</strong><span>${fmtDate(tx.failedAt)}</span></div>` : ""}${tx.canceledAt ? `<div><strong>Canceled</strong><span>${fmtDate(tx.canceledAt)}</span></div>` : ""}</div>
    </section>
    ${isSuperAdmin && (pending || succeeded) ? `<section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">LIFECYCLE</span><h3>Thay đổi trạng thái</h3></div></div>
      <label><span>Lý do / audit</span><textarea id="transactionActionReason" maxlength="500" placeholder="Bắt buộc cho mọi thao tác"></textarea></label>
      ${pending ? `<div class="form-grid"><label><span>Provider reference</span><input id="transactionSettleRef" maxlength="190" value="${escapeHtml(tx.providerReference || "")}" /></label><label><span>Failure code</span><input id="transactionFailureCode" maxlength="100" placeholder="PAYMENT_DECLINED" /></label><label class="full"><span>Failure message</span><input id="transactionFailureMessage" maxlength="500" /></label></div>
      <div class="action-row"><button id="settleTransaction" class="primary">Mark SUCCEEDED</button><button id="failTransaction" class="ghost danger">Mark FAILED</button><button id="cancelTransaction" class="danger-button">Cancel</button></div>` : `<div class="notice warn">Refund là full refund và sẽ hủy subscription PAYMENT liên kết.</div><div class="action-row"><button id="refundTransaction" class="danger-button">Refund transaction</button></div>`}
    </section>` : ""}`;

  const actionReason = () => {
    const reason = $("#transactionActionReason")?.value.trim();
    if (!reason) { toast("Hãy nhập lý do để ghi audit.", "error"); return ""; }
    return reason;
  };
  $("#settleTransaction")?.addEventListener("click", async () => {
    const reason = actionReason(); if (!reason) return;
    try { const saved = await api(`/api/v1/admin/transactions/${tx.id}/settle`, { method: "POST", body: JSON.stringify({ providerReference: $("#transactionSettleRef").value.trim() || null, reason }) }); toast("Transaction đã SUCCEEDED và subscription PAYMENT đã được tạo.", "success"); renderTransactionDrawer(saved); await loadTransactions(); } catch (error) { toast(error.message, "error"); }
  });
  $("#failTransaction")?.addEventListener("click", async () => {
    const reason = actionReason(); if (!reason) return;
    try { const saved = await api(`/api/v1/admin/transactions/${tx.id}/fail`, { method: "POST", body: JSON.stringify({ failureCode: $("#transactionFailureCode").value.trim() || null, failureMessage: $("#transactionFailureMessage").value.trim() || null, reason }) }); toast("Transaction đã được đánh dấu FAILED.", "success"); renderTransactionDrawer(saved); await loadTransactions(); } catch (error) { toast(error.message, "error"); }
  });
  $("#cancelTransaction")?.addEventListener("click", async () => {
    const reason = actionReason(); if (!reason || !window.confirm(`Cancel transaction #${tx.id}?`)) return;
    try { const saved = await api(`/api/v1/admin/transactions/${tx.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); toast("Transaction đã CANCELED.", "success"); renderTransactionDrawer(saved); await loadTransactions(); } catch (error) { toast(error.message, "error"); }
  });
  $("#refundTransaction")?.addEventListener("click", async () => {
    const reason = actionReason(); if (!reason || !window.confirm(`Full refund transaction #${tx.id} và hủy subscription PAYMENT?`)) return;
    try { const saved = await api(`/api/v1/admin/transactions/${tx.id}/refund`, { method: "POST", body: JSON.stringify({ reason }) }); toast("Transaction đã REFUNDED và subscription PAYMENT đã bị hủy.", "success"); renderTransactionDrawer(saved); await loadTransactions(); } catch (error) { toast(error.message, "error"); }
  });
}

async function loadPlans() {
  state.plans = await api("/api/v1/admin/plans");
  const rows = state.plans || [];
  $("#plansTable").innerHTML = rows.length ? `
    <table><thead><tr><th>Plan</th><th>Rank</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
    <tbody>${rows.map((plan) => `
      <tr class="clickable" data-plan-code="${escapeHtml(plan.code)}">
        <td><strong>${escapeHtml(plan.displayName)}</strong><small>${escapeHtml(plan.code)}</small></td>
        <td>${fmtNumber(plan.rankOrder)}</td>
        <td><span class="status-badge ${plan.active ? "ok" : "warn"}">${plan.active ? "ACTIVE" : "DISABLED"}</span></td>
        <td><span class="muted">Bấm để chỉnh feature & limit</span></td>
      </tr>`).join("")}</tbody></table>` : '<div class="empty large">Chưa có plan.</div>';
  $$('[data-plan-code]').forEach((row) => row.addEventListener("click", () => void openPlan(row.dataset.planCode)));
}

async function openPlan(planCode) {
  state.selectedUserId = null;
  state.selectedPlanCode = planCode;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải plan...</div>';
  try {
    const [detail, schema] = await Promise.all([
      api(`/api/v1/admin/plans/${encodeURIComponent(planCode)}`),
      ensurePlanSchema()
    ]);
    renderPlanDrawer(detail, schema, false);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

async function openCreatePlan() {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = "Tạo plan";
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải entitlement schema...</div>';
  try {
    const schema = await ensurePlanSchema();
    const nextRank = Math.max(0, ...(state.plans || []).map((p) => Number(p.rankOrder || 0))) + 10;
    const features = Object.fromEntries((schema.featureKeys || []).map((key) => [key, false]));
    const limits = Object.fromEntries((schema.limitKeys || []).map((key) => [key, 0]));
    renderPlanDrawer({ code: "", displayName: "", description: "", rankOrder: nextRank, active: true, features, limits }, schema, true);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderPlanDrawer(plan, schema, isCreate) {
  $("#drawerTitle").textContent = isCreate ? "Tạo plan mới" : `${plan.displayName} · ${plan.code}`;
  const featureKeys = schema.featureKeys || Object.keys(plan.features || {});
  const limitKeys = schema.limitKeys || Object.keys(plan.limits || {});
  const activeAssignments = Number(plan.usage?.activeOverrides || 0) + Number(plan.usage?.activeSubscriptions || 0);
  const cannotDeactivate = !isCreate && plan.active && activeAssignments > 0;
  $("#drawerBody").innerHTML = `
    <section class="drawer-section plan-section first">
      <div class="section-heading"><div><span class="eyebrow">PLAN DEFINITION</span><h3>Thông tin plan</h3></div></div>
      <div class="form-grid">
        <label><span>Code</span><input id="planCodeField" maxlength="30" value="${escapeHtml(plan.code)}" ${isCreate ? "" : "readonly"} placeholder="ULTIMATE" /></label>
        <label><span>Tên hiển thị</span><input id="planDisplayName" maxlength="80" value="${escapeHtml(plan.displayName)}" placeholder="Ultimate" /></label>
        <label><span>Rank</span><input id="planRank" type="number" min="0" max="100000" value="${Number(plan.rankOrder || 0)}" /></label>
        <label class="toggle-field"><span>Trạng thái</span><span class="toggle-line"><input id="planActive" type="checkbox" ${plan.active ? "checked" : ""} ${(plan.code === "FREE" && !isCreate) || cannotDeactivate ? "disabled" : ""} /> Active</span></label>
      </div>
      <label><span>Mô tả</span><textarea id="planDescription" rows="2" maxlength="500" placeholder="Mô tả nội bộ cho plan...">${escapeHtml(plan.description || "")}</textarea></label>
    </section>
    ${!isCreate ? `<section class="drawer-section plan-section">
      <div class="section-heading"><div><span class="eyebrow">LIFECYCLE</span><h3>Plan đang được sử dụng</h3></div><small class="muted">Bảo vệ trước khi tắt plan</small></div>
      <div class="detail-grid">
        <div><span>Subscription hiệu lực</span><strong>${fmtNumber(plan.usage?.activeSubscriptions || 0)}</strong><small>user đang nhận plan</small></div>
        <div><span>Admin override</span><strong>${fmtNumber(plan.usage?.activeOverrides || 0)}</strong><small>override còn hiệu lực</small></div>
        <div><span>License còn dùng được</span><strong>${fmtNumber(plan.usage?.usableLicenses || 0)}</strong><small>license AVAILABLE chưa hết hạn</small></div>
      </div>
      ${cannotDeactivate ? `<div class="notice warn">Không thể tắt plan khi còn subscription hoặc Admin override hiệu lực. Hãy chuyển user sang plan khác trước.</div>` : ""}
      ${Number(plan.usage?.usableLicenses || 0) > 0 ? `<div class="notice info">Nếu tắt plan, các license chưa kích hoạt của plan này sẽ tạm thời không thể kích hoạt cho tới khi plan được bật lại.</div>` : ""}
    </section>` : ""}
    <section class="drawer-section plan-section">
      <div class="section-heading"><div><span class="eyebrow">FEATURES</span><h3>Quyền tính năng</h3></div><small class="muted">Bật/tắt không cần rebuild Desktop</small></div>
      <div class="feature-grid">${featureKeys.map((key) => `
        <label class="feature-row"><span><strong>${escapeHtml(humanKey(key, FEATURE_LABELS))}</strong><small>${escapeHtml(key)}</small></span><input type="checkbox" data-feature-key="${escapeHtml(key)}" ${plan.features?.[key] ? "checked" : ""} /></label>`).join("")}</div>
    </section>
    <section class="drawer-section plan-section">
      <div class="section-heading"><div><span class="eyebrow">LIMITS</span><h3>Quota & giới hạn</h3></div><small class="muted">-1 = không giới hạn</small></div>
      <div class="limit-grid">${limitKeys.map((key) => `
        <label><span>${escapeHtml(humanKey(key, LIMIT_LABELS))}<small>${escapeHtml(key)}</small></span><input type="number" min="-1" step="1" data-limit-key="${escapeHtml(key)}" value="${Number(plan.limits?.[key] ?? 0)}" /></label>`).join("")}</div>
    </section>
    <section class="drawer-section plan-section">
      <label><span>Lý do thay đổi</span><textarea id="planReason" rows="2" maxlength="500" placeholder="Bắt buộc để ghi audit..."></textarea></label>
      <div class="action-row"><button id="savePlanDefinition" class="primary">${isCreate ? "Tạo plan" : "Lưu thay đổi"}</button></div>
      <small class="muted">Plan code không thể đổi sau khi tạo. Pricing/subscription không nằm trong Batch 14.6.</small>
    </section>`;

  $("#savePlanDefinition").addEventListener("click", async () => {
    const code = $("#planCodeField").value.trim().toUpperCase();
    const displayName = $("#planDisplayName").value.trim();
    const description = $("#planDescription").value.trim();
    const rankOrder = Number($("#planRank").value);
    const active = $("#planActive").checked;
    const reason = $("#planReason").value.trim();
    if (!code || !displayName || !reason) {
      toast("Code, tên hiển thị và lý do là bắt buộc.", "error");
      return;
    }
    const features = Object.fromEntries($$("[data-feature-key]").map((input) => [input.dataset.featureKey, input.checked]));
    const limits = Object.fromEntries($$("[data-limit-key]").map((input) => [input.dataset.limitKey, Number(input.value)]));
    const body = { displayName, description, rankOrder, active, features, limits, reason };
    if (isCreate) body.code = code;
    try {
      const saved = await api(isCreate ? "/api/v1/admin/plans" : `/api/v1/admin/plans/${encodeURIComponent(plan.code)}`, {
        method: isCreate ? "POST" : "PUT",
        body: JSON.stringify(body)
      });
      toast(isCreate ? `Đã tạo plan ${saved.code}.` : `Đã cập nhật ${saved.code}.`, "success");
      state.plans = [];
      closeDrawer();
      await loadPlans();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function loadUsers() {
  if (!state.plans.length) state.plans = await api("/api/v1/admin/plans");
  const query = encodeURIComponent($("#userSearch").value.trim());
  const status = encodeURIComponent($("#statusFilter").value);
  const data = await api(`/api/v1/admin/users?query=${query}&status=${status}&page=${state.usersPage}&size=${state.usersSize}`);
  state.usersTotal = data.total;
  const rows = data.items || [];
  $("#usersTable").innerHTML = rows.length ? `
    <table><thead><tr><th>User</th><th>Plan</th><th>Identity</th><th>Usage tháng</th><th>Sessions</th><th>Trạng thái</th></tr></thead>
    <tbody>${rows.map((user) => `
      <tr class="clickable" data-user-id="${user.id}">
        <td><strong>${escapeHtml(user.email)}</strong><small>#${user.id} · ${escapeHtml(user.role)}</small></td>
        <td><span class="plan-pill">${escapeHtml(user.planCode)}</span><small>${escapeHtml(user.planSource)}</small></td>
        <td>${(user.identities || []).map((x) => `<span class="identity-pill">${escapeHtml(x)}</span>`).join(" ") || '<span class="muted">LOCAL</span>'}</td>
        <td>${fmtNumber(user.monthlyUsage)}</td><td>${fmtNumber(user.activeSessions)}</td>
        <td><span class="status-badge ${user.status === "ACTIVE" ? "ok" : "warn"}">${escapeHtml(user.status)}</span></td>
      </tr>`).join("")}</tbody></table>` : '<div class="empty large">Không tìm thấy người dùng.</div>';
  $$("[data-user-id]").forEach((row) => row.addEventListener("click", () => void openUser(Number(row.dataset.userId))));
  const pages = Math.max(1, Math.ceil(data.total / data.size));
  $("#usersPageMeta").textContent = `Trang ${data.page + 1}/${pages} · ${fmtNumber(data.total)} user`;
  $("#prevUsers").disabled = data.page <= 0;
  $("#nextUsers").disabled = data.page + 1 >= pages;
}

async function openUser(userId) {
  state.selectedUserId = userId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải user...</div>';
  try {
    const [detail, subscriptions, prices] = await Promise.all([
      api(`/api/v1/admin/users/${userId}`),
      api(`/api/v1/admin/users/${userId}/subscriptions`),
      api("/api/v1/admin/prices")
    ]);
    detail.subscriptions = subscriptions || [];
    state.prices = prices || [];
    renderUserDrawer(detail);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderUserDrawer(detail) {
  const user = detail.user;
  $("#drawerTitle").textContent = user.email;
  const plans = state.plans.filter((p) => p.active).map((p) => `<option value="${escapeHtml(p.code)}" ${p.code === user.planCode ? "selected" : ""}>${escapeHtml(p.displayName)} · ${escapeHtml(p.code)}</option>`).join("");
  const isSuspended = user.status !== "ACTIVE";
  $("#drawerBody").innerHTML = `
    <div class="user-hero"><div class="avatar">${escapeHtml(user.email.slice(0, 1).toUpperCase())}</div><div><strong>${escapeHtml(user.email)}</strong><span>#${user.id} · ${escapeHtml(user.role)}</span></div><span class="status-badge ${isSuspended ? "warn" : "ok"}">${escapeHtml(user.status)}</span></div>
    <div class="detail-grid">
      <div><span>Plan hiệu lực</span><strong>${escapeHtml(user.planCode)}</strong><small>${escapeHtml(user.planSource)} · ${fmtDate(user.planEndsAt)}</small></div>
      <div><span>Usage tháng</span><strong>${fmtNumber(user.monthlyUsage)}</strong><small>translation events</small></div>
      <div><span>Identity</span><strong>${(user.identities || []).map(escapeHtml).join(", ") || "LOCAL"}</strong><small>provider liên kết</small></div>
      <div><span>Ngày tạo</span><strong>${fmtDate(user.createdAt)}</strong><small>${fmtNumber(user.activeSessions)} session active</small></div>
    </div>
    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">ACCESS</span><h3>Trạng thái & phiên</h3></div></div>
      <label><span>Lý do thao tác</span><textarea id="actionReason" rows="2" placeholder="Bắt buộc để audit..."></textarea></label>
      <div class="action-row">
        <button id="toggleStatus" class="${isSuspended ? "primary" : "danger-button"}">${isSuspended ? "Mở khóa user" : "Khóa user"}</button>
        <button id="revokeSessions" class="ghost">Thu hồi mọi session</button>
        <button id="resetDeviceBinding" class="danger-button">Reset liên kết thiết bị</button>
      </div>
      <small class="muted">Reset thiết bị sẽ gỡ máy đang liên kết và thu hồi toàn bộ session của tài khoản.</small>
    </section>
    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">PLAN OVERRIDE</span><h3>Quyền gói tạm thời</h3></div></div>
      <div class="form-grid"><label><span>Plan</span><select id="planSelect">${plans}</select></label><label><span>Hết hạn (tùy chọn)</span><input id="planExpiry" type="datetime-local" /></label></div>
      <div class="action-row"><button id="savePlan" class="primary">Áp dụng override</button><button id="clearPlan" class="ghost">Trả về license/subscription</button></div>
      <small class="muted">Override không sửa hoặc xóa license gốc. Xóa override sẽ quay lại quyền thực tế.</small>
    </section>
    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">SUBSCRIPTIONS</span><h3>Lịch sử & cấp subscription</h3></div><small class="muted">14.7.3</small></div>
      <div class="subscription-create">
        <div class="form-grid">
          <label><span>Plan</span><select id="subscriptionPlan">${state.plans.filter((p) => p.active).map((p) => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.displayName)} · ${escapeHtml(p.code)}</option>`).join("")}</select></label>
          <label><span>Price (tùy chọn)</span><select id="subscriptionPrice"><option value="">Không gắn price</option></select></label>
          <label><span>Status</span><select id="subscriptionStatus"><option value="ACTIVE">ACTIVE</option><option value="TRIAL">TRIAL</option><option value="GRANDFATHERED">GRANDFATHERED</option></select></label>
          <label><span>Bắt đầu</span><input id="subscriptionStart" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(new Date().toISOString()))}" /></label>
          <label><span>Kết thúc</span><input id="subscriptionEnd" type="datetime-local" /></label>
        </div>
        <div class="notice info">Nếu chọn price MONTHLY/YEARLY và để trống ngày kết thúc, backend tự tính 1 chu kỳ. LIFETIME sẽ không có ngày hết hạn.</div>
        <div class="action-row"><button id="createSubscription" class="primary">Cấp subscription</button></div>
      </div>
      ${subscriptionRows(detail.subscriptions || [])}
    </section>
    <section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">SESSIONS</span><h3>Phiên đang hoạt động</h3></div></div>${sessionRows(detail.sessions || [])}</section>
    <section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">AUDIT</span><h3>Lịch sử user</h3></div></div>${auditRows(detail.recentAudit || [], true)}</section>`;

  $("#toggleStatus").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    await userAction(`/api/v1/admin/users/${user.id}/status`, "PATCH", { status: isSuspended ? "ACTIVE" : "SUSPENDED", reason });
  });
  $("#revokeSessions").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    await userAction(`/api/v1/admin/users/${user.id}/sessions/revoke-all`, "POST", { reason });
  });

  $("#resetDeviceBinding").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;

    const confirmed = window.confirm(
      `Reset liên kết thiết bị cho ${user.email}?\n\n` +
      "Toàn bộ phiên đăng nhập hiện tại sẽ bị thu hồi. " +
      "Lần đăng nhập tiếp theo sẽ liên kết tài khoản với thiết bị mới."
    );

    if (!confirmed) return;

    await userAction(
      `/api/v1/admin/users/${user.id}/device-binding/reset`,
      "POST",
      { reason }
    );
  });
  $("#savePlan").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    const raw = $("#planExpiry").value;
    const expiresAt = raw ? new Date(raw).toISOString() : null;
    await userAction(`/api/v1/admin/users/${user.id}/plan-override`, "PUT", { planCode: $("#planSelect").value, expiresAt, reason });
  });
  $("#clearPlan").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    await userAction(`/api/v1/admin/users/${user.id}/plan-override/clear`, "POST", { reason });
  });

  const refreshSubscriptionPrices = () => {
    const planCode = $("#subscriptionPlan").value;
    const matching = state.prices.filter((price) => price.planCode === planCode && price.active);
    $("#subscriptionPrice").innerHTML = `<option value="">Không gắn price</option>${matching.map((price) => `<option value="${price.id}">#${price.id} · ${escapeHtml(BILLING_LABELS[price.billingPeriod] || price.billingPeriod)} · ${escapeHtml(fmtMoneyMinor(price.amountMinor, price.currency))}${price.currentlyAvailable ? " · ON SALE" : ""}</option>`).join("")}`;
  };
  refreshSubscriptionPrices();
  $("#subscriptionPlan").addEventListener("change", refreshSubscriptionPrices);

  $("#createSubscription").addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    let startsAt;
    let endsAt;
    try {
      startsAt = localDateTimeToIso($("#subscriptionStart").value);
      endsAt = localDateTimeToIso($("#subscriptionEnd").value);
    } catch (error) { toast(error.message, "error"); return; }
    const priceRaw = $("#subscriptionPrice").value;
    const body = {
      planCode: $("#subscriptionPlan").value,
      priceId: priceRaw ? Number(priceRaw) : null,
      status: $("#subscriptionStatus").value,
      startsAt,
      endsAt,
      reason
    };
    try {
      const created = await api(`/api/v1/admin/users/${user.id}/subscriptions`, { method: "POST", body: JSON.stringify(body) });
      toast(`Đã cấp subscription #${created.id} · ${created.planCode}.`, "success");
      await openUser(user.id);
      if (state.currentView === "users") await loadUsers();
    } catch (error) { toast(error.message, "error"); }
  });

  $$('[data-extend-subscription]').forEach((button) => button.addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    const id = Number(button.dataset.extendSubscription);
    let endsAt;
    try { endsAt = localDateTimeToIso($(`[data-subscription-end="${id}"]`).value); }
    catch (error) { toast(error.message, "error"); return; }
    if (!endsAt) { toast("Hãy chọn ngày hết hạn mới.", "error"); return; }
    try {
      await api(`/api/v1/admin/subscriptions/${id}/extend`, { method: "POST", body: JSON.stringify({ endsAt, reason }) });
      toast(`Đã gia hạn subscription #${id}.`, "success");
      await openUser(user.id);
      if (state.currentView === "users") await loadUsers();
    } catch (error) { toast(error.message, "error"); }
  }));

  $$('[data-cancel-subscription]').forEach((button) => button.addEventListener("click", async () => {
    const reason = requireReason(); if (!reason) return;
    const id = Number(button.dataset.cancelSubscription);
    if (!window.confirm(`Hủy subscription #${id}?`)) return;
    try {
      await api(`/api/v1/admin/subscriptions/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      toast(`Đã hủy subscription #${id}.`, "success");
      await openUser(user.id);
      if (state.currentView === "users") await loadUsers();
    } catch (error) { toast(error.message, "error"); }
  }));
}

const aiCostStatus = (cost) => {
  if (cost.currentlyEffective) return { label: "EFFECTIVE", kind: "ok" };
  if (!cost.active) return { label: "INACTIVE", kind: "warn" };
  const now = Date.now();
  const starts = cost.effectiveFrom ? new Date(cost.effectiveFrom).getTime() : null;
  const ends = cost.effectiveTo ? new Date(cost.effectiveTo).getTime() : null;
  if (starts != null && starts > now) return { label: "SCHEDULED", kind: "info" };
  if (ends != null && ends <= now) return { label: "EXPIRED", kind: "warn" };
  return { label: "NOT EFFECTIVE", kind: "warn" };
};

const fmtAiRate = (value, currency) => {
  const number = Number(value ?? 0);
  const code = String(currency || "USD").toUpperCase();
  const digits = Math.abs(number) < 0.01 && number !== 0 ? 8 : 6;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number)} ${code} / 1M`;
};

function rawMetric(label, value, hint) {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}

function renderAiCostTrend(daily, currency) {
  const rows = Array.isArray(daily) ? daily : [];
  const maxCost = Math.max(0, ...rows.map((row) => Number(row.estimatedCost || 0)));
  const totalCost = rows.reduce((sum, row) => sum + Number(row.estimatedCost || 0), 0);
  const bars = rows.length ? rows.map((row) => {
    const value = Number(row.estimatedCost || 0);
    const height = maxCost > 0 ? Math.max(value > 0 ? 6 : 2, Math.round((value / maxCost) * 100)) : 2;
    const dateLabel = String(row.date || "").slice(5).replace("-", "/");
    return `<div class="cost-trend-point" title="${escapeHtml(`${row.date} · ${fmtCost(value, currency)} · ${fmtNumber(row.requests)} requests`)}">
      <div class="cost-trend-column"><i style="height:${height}%"></i></div>
      <small>${escapeHtml(dateLabel)}</small>
    </div>`;
  }).join("") : '<div class="empty">Chưa có dữ liệu.</div>';

  return `<div class="card-heading"><div><span class="eyebrow">COST TREND</span><h3>AI cost theo ngày</h3></div><strong class="money-value">${escapeHtml(fmtCost(totalCost, currency))}</strong></div>
    <div class="cost-trend-chart">${bars}</div>`;
}

function renderAiBreakdown(title, eyebrow, rows, currency, dimension = "") {
  const values = Array.isArray(rows) ? rows : [];
  const maxCost = Math.max(0, ...values.map((row) => Number(row.estimatedCost || 0)));
  const maxRequests = Math.max(0, ...values.map((row) => Number(row.requests || 0)));
  if (!values.length) {
    return `<div class="card-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div></div><div class="empty">Chưa có dữ liệu.</div>`;
  }
  return `<div class="card-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div>${dimension ? '<small class="muted">click để drill-down</small>' : ''}</div>
    <div class="cost-breakdown-list">${values.map((row) => {
      const cost = Number(row.estimatedCost || 0);
      const requests = Number(row.requests || 0);
      const basis = maxCost > 0 ? cost : requests;
      const max = maxCost > 0 ? maxCost : maxRequests;
      const width = max > 0 ? Math.max(4, Math.round((basis / max) * 100)) : 4;
      const drillAttrs = dimension
        ? ` role="button" tabindex="0" data-ai-drilldown-dimension="${escapeHtml(dimension)}" data-ai-drilldown-key="${escapeHtml(row.key || '')}" data-ai-drilldown-label="${escapeHtml(row.label || row.key || '—')}"`
        : "";
      return `<div class="cost-breakdown-row ${dimension ? 'drillable' : ''}"${drillAttrs}>
        <div class="cost-breakdown-head"><strong title="${escapeHtml(row.label || row.key)}">${escapeHtml(row.label || row.key || "—")}</strong><span>${escapeHtml(fmtCost(cost, currency))}</span></div>
        <div class="bar-track"><i style="width:${width}%"></i></div>
        <small>${fmtNumber(requests)} req · ${fmtCompactNumber(row.inputTokens)} in · ${fmtCompactNumber(row.outputTokens)} out${Number(row.missingRateEvents || 0) ? ` · <b>${fmtNumber(row.missingRateEvents)} missing rate</b>` : ""}</small>
      </div>`;
    }).join("")}</div>`;
}

function renderRecentAiUsage(rows, clickable = true) {
  const values = Array.isArray(rows) ? rows : [];
  if (!values.length) return '<div class="empty">Chưa có AI usage event.</div>';
  return `<div class="ai-recent-list">${values.slice(0, 50).map((row) => {
    const statusKind = row.successful ? "ok" : "warn";
    const costKind = row.costStatus === "CALCULATED" ? "ok" : row.costStatus === "MISSING_RATE" ? "warn" : "info";
    const attrs = clickable ? ` role="button" tabindex="0" data-ai-usage-id="${Number(row.id)}"` : "";
    return `<div class="ai-recent-row ${clickable ? 'drillable' : ''}"${attrs}>
      <div><strong>${escapeHtml(row.feature || "GENERAL")}</strong><span>${escapeHtml(row.provider)} · ${escapeHtml(row.model)}</span><small>${escapeHtml(row.userEmail || `User #${row.userId || "—"}`)} · ${fmtDate(row.createdAt)}</small></div>
      <div class="ai-recent-meta"><span>${fmtCompactNumber(row.totalTokens)} tokens</span><strong>${escapeHtml(row.costStatus === "CALCULATED" ? fmtCost(row.estimatedCost, row.costCurrency) : row.costStatus || "—")}</strong><small>${fmtLatency(row.latencyMs)}</small></div>
      <div><span class="status-badge ${statusKind}">${row.successful ? "OK" : "FAILED"}</span><span class="status-badge ${costKind}">${escapeHtml(row.costStatus || "NO COST")}</span></div>
    </div>`;
  }).join("")}</div>`;
}

function renderAiAnalytics(dashboard, recent) {
  const currency = dashboard.reportingCurrency || "USD";
  state.adminTimeZone = dashboard.analyticsTimeZone || state.adminTimeZone || "Asia/Ho_Chi_Minh";
  const costCoverage = Number(dashboard.requests || 0) > 0
    ? (Number(dashboard.calculatedCostEvents || 0) / Number(dashboard.requests || 1)) * 100
    : 100;

  $("#aiAnalyticsMetrics").innerHTML = `
    ${rawMetric("Requests", fmtNumber(dashboard.requests), `${fmtNumber(dashboard.failedRequests)} failed`)}
    ${rawMetric("AI Cost", Number(dashboard.requests || 0) > 0 && costCoverage === 0 ? "Chưa tính được" : fmtCost(dashboard.estimatedCost, currency), `${fmtPercent(costCoverage)} cost coverage`)}
    ${rawMetric("Input tokens", fmtCompactNumber(dashboard.inputTokens), `${fmtCompactNumber(dashboard.cachedTokens)} cached`)}
    ${rawMetric("Output tokens", fmtCompactNumber(dashboard.outputTokens), `${fmtCompactNumber(dashboard.totalTokens)} total`)}
    ${rawMetric("Success rate", fmtPercent(dashboard.successRatePercent), `${fmtNumber(dashboard.successfulRequests)} successful`)}
    ${rawMetric("Avg latency", fmtLatency(dashboard.averageLatencyMs), `${dashboard.days} day window`)}
  `;

  const missing = Number(dashboard.missingRateEvents || 0);
  const unavailable = Number(dashboard.tokenUsageUnavailableEvents || 0);
  $("#aiAnalyticsNotice").innerHTML = missing || unavailable
    ? `<div class="notice warn ai-analytics-notice"><strong>Cost coverage chưa hoàn chỉnh.</strong> ${fmtNumber(missing)} event thiếu model rate, ${fmtNumber(unavailable)} event thiếu token metadata. Total cost chỉ cộng các event CALCULATED.</div>`
    : `<div class="notice info ai-analytics-notice">Cost coverage đầy đủ cho khoảng đang xem. Currency báo cáo: <strong>${escapeHtml(currency)}</strong>. Dashboard chỉ dùng metadata, không lưu prompt/OCR/document/translation content.</div>`;

  $("#aiCostTrend").innerHTML = renderAiCostTrend(dashboard.daily, currency);
  $("#aiCostByUser").innerHTML = renderAiBreakdown("Theo user", "USERS", dashboard.users, currency, "USER");
  $("#aiCostByProvider").innerHTML = renderAiBreakdown("Theo provider", "PROVIDERS", dashboard.providers, currency, "PROVIDER");
  $("#aiCostByModel").innerHTML = renderAiBreakdown("Theo model", "MODELS", dashboard.models, currency, "MODEL");
  $("#aiCostByFeature").innerHTML = renderAiBreakdown("Theo feature", "FEATURES", dashboard.features, currency, "FEATURE");
  $("#aiCostByPlan").innerHTML = renderAiBreakdown("Theo plan", "PLANS", dashboard.plans, currency, "PLAN");
  $("#aiCostRecent").innerHTML = `<div class="card-heading"><div><span class="eyebrow">RECENT USAGE</span><h3>AI requests gần nhất</h3></div><span class="muted">latest 12 · ${escapeHtml(state.adminTimeZone)}</span></div>${renderRecentAiUsage(recent)}`;
  bindAiDrilldownLinks();
  bindAiUsageLinks();
}

function bindAiDrilldownLinks(root = document) {
  root.querySelectorAll?.("[data-ai-drilldown-dimension]").forEach((row) => {
    const open = () => void openAiCostDrilldown(
      row.dataset.aiDrilldownDimension,
      row.dataset.aiDrilldownKey,
      row.dataset.aiDrilldownLabel
    );
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function bindAiUsageLinks(root = document) {
  root.querySelectorAll?.("[data-ai-usage-id]").forEach((row) => {
    const open = () => void openAiUsageEvent(Number(row.dataset.aiUsageId));
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

async function openAiCostDrilldown(dimension, key, fallbackLabel = "") {
  if (!dimension || key == null || key === "") return;
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = null;
  state.selectedTransactionId = null;
  state.selectedAiCostId = null;
  state.selectedAiDrilldown = { dimension, key, label: fallbackLabel };
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = fallbackLabel || `${dimension}: ${key}`;
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải cost drill-down...</div>';

  try {
    const params = new URLSearchParams({
      days: String(state.aiDashboardDays || 7),
      dimension: String(dimension),
      key: String(key)
    });
    const data = await api(`/api/v1/admin/ai-cost-drilldown?${params}`);
    state.adminTimeZone = data.analyticsTimeZone || state.adminTimeZone;
    renderAiCostDrilldownDrawer(data);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderAiCostDrilldownDrawer(data) {
  const summary = data.summary || {};
  const currency = data.reportingCurrency || "USD";
  const requests = Number(summary.requests || 0);
  const coverage = requests > 0 ? Number(summary.calculatedCostEvents || 0) / requests * 100 : 100;
  const dimensionLabel = {
    USER: "USER",
    PLAN: "PLAN",
    FEATURE: "FEATURE",
    PROVIDER: "PROVIDER",
    MODEL: "MODEL"
  }[data.dimension] || data.dimension;

  $("#drawerTitle").textContent = data.label || data.key || "AI Cost Drill-down";
  $("#drawerBody").innerHTML = `
    <section class="drawer-section first ai-drilldown-hero">
      <div class="section-heading">
        <div><span class="eyebrow">AI COST DRILL-DOWN · ${escapeHtml(dimensionLabel)}</span><h3>${escapeHtml(data.label || data.key || "—")}</h3></div>
        <span class="status-badge info">${data.days} ngày</span>
      </div>
      <div class="ai-scope-meta"><span>${fmtDate(data.from)} → ${fmtDate(data.to)}</span><span>${escapeHtml(data.analyticsTimeZone || state.adminTimeZone)}</span><span>${escapeHtml(currency)}</span></div>
      <div class="metric-grid drawer-metrics">
        ${rawMetric("Requests", fmtNumber(summary.requests), `${fmtNumber(summary.failedRequests)} failed`)}
        ${rawMetric("AI Cost", requests > 0 && coverage === 0 ? "Chưa tính được" : fmtCost(summary.estimatedCost, currency), `${fmtPercent(coverage)} coverage`)}
        ${rawMetric("Input", fmtCompactNumber(summary.inputTokens), `${fmtCompactNumber(summary.cachedTokens)} cached`)}
        ${rawMetric("Output", fmtCompactNumber(summary.outputTokens), `${fmtCompactNumber(summary.totalTokens)} total`)}
        ${rawMetric("Success", fmtPercent(summary.successRatePercent), `${fmtNumber(summary.successfulRequests)} successful`)}
        ${rawMetric("Latency", fmtLatency(summary.averageLatencyMs), "average")}
      </div>
      ${Number(summary.missingRateEvents || 0) || Number(summary.tokenUsageUnavailableEvents || 0)
        ? `<div class="notice warn"><strong>Cost coverage chưa đầy đủ.</strong> ${fmtNumber(summary.missingRateEvents)} missing rate · ${fmtNumber(summary.tokenUsageUnavailableEvents)} thiếu token metadata.</div>`
        : '<div class="notice info">Cost coverage đầy đủ trong scope này.</div>'}
    </section>

    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">BREAKDOWN</span><h3>Phân rã cost trong scope</h3></div><small>Click một dòng để đi sâu hơn</small></div>
      <div class="ai-drilldown-grid">
        <article class="mini-card">${renderAiBreakdown("Theo user", "USERS", data.users, currency, "USER")}</article>
        <article class="mini-card">${renderAiBreakdown("Theo plan", "PLANS", data.plans, currency, "PLAN")}</article>
        <article class="mini-card">${renderAiBreakdown("Theo feature", "FEATURES", data.features, currency, "FEATURE")}</article>
        <article class="mini-card">${renderAiBreakdown("Theo provider", "PROVIDERS", data.providers, currency, "PROVIDER")}</article>
        <article class="mini-card">${renderAiBreakdown("Theo model", "MODELS", data.models, currency, "MODEL")}</article>
      </div>
    </section>

    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">REQUESTS</span><h3>AI requests trong scope</h3></div><small>${Math.min(50, (data.recent || []).length)} gần nhất</small></div>
      ${renderRecentAiUsage(data.recent, true)}
    </section>`;

  bindAiDrilldownLinks($("#drawerBody"));
  bindAiUsageLinks($("#drawerBody"));
}

async function openAiUsageEvent(eventId) {
  if (!eventId) return;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = `AI Request #${eventId}`;
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải AI request metadata...</div>';
  try {
    const row = await api(`/api/v1/admin/ai-usage/${eventId}`);
    renderAiUsageEventDrawer(row);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderAiUsageEventDrawer(row) {
  const calculated = row.costStatus === "CALCULATED";
  const successKind = row.successful ? "ok" : "warn";
  const costKind = calculated ? "ok" : row.costStatus === "MISSING_RATE" ? "warn" : "info";
  $("#drawerTitle").textContent = `AI Request #${row.id}`;
  $("#drawerBody").innerHTML = `
    <section class="drawer-section first">
      <div class="section-heading">
        <div><span class="eyebrow">AI REQUEST METADATA</span><h3>${escapeHtml(row.feature || "GENERAL")}</h3></div>
        <div><span class="status-badge ${successKind}">${row.successful ? "SUCCESS" : "FAILED"}</span> <span class="status-badge ${costKind}">${escapeHtml(row.costStatus || "NO COST")}</span></div>
      </div>
      <div class="detail-grid ai-event-detail">
        <div><span>Thời gian</span><strong>${fmtDate(row.createdAt)}</strong><small>${escapeHtml(state.adminTimeZone)}</small></div>
        <div><span>User</span><strong>${escapeHtml(row.userEmail || `User #${row.userId || "—"}`)}</strong><small>Plan snapshot: ${escapeHtml(row.planCode || "—")}</small></div>
        <div><span>Provider / Model</span><strong>${escapeHtml(row.provider || "—")} · ${escapeHtml(row.model || "—")}</strong><small>Provider request: ${escapeHtml(row.providerRequestId || "—")}</small></div>
        <div><span>Request ID</span><strong class="mono-value">${escapeHtml(row.requestId || "—")}</strong><small>Ledger event #${row.id}</small></div>
        <div><span>Input tokens</span><strong>${fmtNumber(row.inputTokens)}</strong><small>${fmtNumber(row.cachedTokens)} cached</small></div>
        <div><span>Output tokens</span><strong>${fmtNumber(row.outputTokens)}</strong><small>${fmtNumber(row.totalTokens)} total</small></div>
        <div><span>Latency</span><strong>${fmtLatency(row.latencyMs)}</strong><small>${row.errorCode ? escapeHtml(row.errorCode) : "No error"}</small></div>
        <div><span>Total cost</span><strong>${calculated ? escapeHtml(fmtCost(row.estimatedCost, row.costCurrency)) : escapeHtml(row.costStatus || "—")}</strong><small>Model cost #${escapeHtml(row.modelCostId || "—")}</small></div>
      </div>
    </section>
    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">COST SNAPSHOT</span><h3>Rate và cost tại thời điểm request</h3></div></div>
      <div class="detail-grid ai-event-detail">
        <div><span>Input rate / 1M</span><strong>${row.inputRatePerMillion == null ? "—" : escapeHtml(fmtAiRate(row.inputRatePerMillion, row.costCurrency))}</strong><small>non-cached input</small></div>
        <div><span>Cached rate / 1M</span><strong>${row.cachedInputRatePerMillion == null ? "—" : escapeHtml(fmtAiRate(row.cachedInputRatePerMillion, row.costCurrency))}</strong><small>cached input</small></div>
        <div><span>Output rate / 1M</span><strong>${row.outputRatePerMillion == null ? "—" : escapeHtml(fmtAiRate(row.outputRatePerMillion, row.costCurrency))}</strong><small>output</small></div>
        <div><span>Input cost</span><strong>${row.inputCost == null ? "—" : escapeHtml(fmtCost(row.inputCost, row.costCurrency))}</strong></div>
        <div><span>Cached cost</span><strong>${row.cachedInputCost == null ? "—" : escapeHtml(fmtCost(row.cachedInputCost, row.costCurrency))}</strong></div>
        <div><span>Output cost</span><strong>${row.outputCost == null ? "—" : escapeHtml(fmtCost(row.outputCost, row.costCurrency))}</strong></div>
        <div><span>Calculated at</span><strong>${row.costCalculatedAt ? fmtDate(row.costCalculatedAt) : "—"}</strong></div>
        <div><span>Content privacy</span><strong>Metadata only</strong><small>Không lưu prompt/OCR/document/translation text.</small></div>
      </div>
    </section>`;
}

async function loadAiCosts() {
  const params = new URLSearchParams();
  if (state.aiCostProviderFilter) params.set("provider", state.aiCostProviderFilter);
  if (state.aiCostModelFilter) params.set("model", state.aiCostModelFilter);
  if (state.aiCostActiveFilter) params.set("active", state.aiCostActiveFilter);
  params.set("limit", "500");

  const safeDays = [1, 7, 30].includes(Number(state.aiDashboardDays)) ? Number(state.aiDashboardDays) : 7;
  state.aiDashboardDays = safeDays;
  $("#aiDashboardDays").value = String(safeDays);

  const [dashboard, recent, modelCosts] = await Promise.all([
    api(`/api/v1/admin/ai-cost-dashboard?days=${safeDays}`),
    api("/api/v1/admin/ai-usage?limit=20"),
    api(`/api/v1/admin/ai-model-costs?${params}`)
  ]);
  state.aiCostDashboard = dashboard;
  state.aiRecentUsage = recent;
  state.aiModelCosts = modelCosts;
  renderAiAnalytics(dashboard, recent);

  const effective = state.aiModelCosts.filter((cost) => cost.currentlyEffective).length;
  const scheduled = state.aiModelCosts.filter((cost) => aiCostStatus(cost).label === "SCHEDULED").length;
  const historical = state.aiModelCosts.filter((cost) => ["EXPIRED", "INACTIVE"].includes(aiCostStatus(cost).label)).length;
  const models = new Set(state.aiModelCosts.map((cost) => `${cost.provider}/${cost.model}`)).size;

  $("#aiCostMetrics").innerHTML = `
    ${metric("Cost records", state.aiModelCosts.length, "versioned configurations")}
    ${metric("Đang hiệu lực", effective, "current rate")}
    ${metric("Models", models, "provider / model")}
    ${metric("Scheduled / history", scheduled + historical, `${scheduled} scheduled`)}
  `;

  $("#createAiCostButton").disabled = state.admin?.role !== "SUPER_ADMIN";
  $("#createAiCostButton").title = state.admin?.role === "SUPER_ADMIN" ? "Tạo model cost" : "Chỉ SUPER_ADMIN được thay đổi cost";
  $("#backfillAiCostsButton").disabled = state.admin?.role !== "SUPER_ADMIN";
  $("#backfillAiCostsButton").title = state.admin?.role === "SUPER_ADMIN" ? "Backfill event đang MISSING_RATE" : "Chỉ SUPER_ADMIN được backfill cost";

  $("#aiCostsTable").innerHTML = state.aiModelCosts.length ? `
    <table><thead><tr><th>Provider / Model</th><th>Input / 1M</th><th>Cached / 1M</th><th>Output / 1M</th><th>Hiệu lực</th><th>Trạng thái</th></tr></thead>
    <tbody>${state.aiModelCosts.map((cost) => {
      const status = aiCostStatus(cost);
      return `<tr class="clickable" data-ai-cost-id="${cost.id}">
        <td><strong>${escapeHtml(cost.provider)} · ${escapeHtml(cost.model)}</strong><small>#${cost.id} · ${escapeHtml(cost.currency)}</small></td>
        <td><strong class="ai-rate input">${escapeHtml(fmtAiRate(cost.inputCostPerMillion, cost.currency))}</strong></td>
        <td><strong class="ai-rate cached">${escapeHtml(fmtAiRate(cost.cachedInputCostPerMillion, cost.currency))}</strong></td>
        <td><strong class="ai-rate output">${escapeHtml(fmtAiRate(cost.outputCostPerMillion, cost.currency))}</strong></td>
        <td><span>${cost.effectiveFrom ? fmtDate(cost.effectiveFrom) : "Ngay lập tức"}</span><small>→ ${cost.effectiveTo ? fmtDate(cost.effectiveTo) : "Không giới hạn"}</small></td>
        <td><span class="status-badge ${status.kind}">${status.label}</span></td>
      </tr>`;
    }).join("")}</tbody></table>`
    : '<div class="empty large">Chưa có AI model cost configuration cho bộ lọc này.</div>';

  $$('[data-ai-cost-id]').forEach((row) => row.addEventListener("click", () => void openAiCost(Number(row.dataset.aiCostId))));
}

async function openAiCost(costId) {
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = null;
  state.selectedTransactionId = null;
  state.selectedAiCostId = costId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải AI model cost...</div>';
  try {
    const cost = await api(`/api/v1/admin/ai-model-costs/${costId}`);
    renderAiCostDrawer(cost, false);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function openCreateAiCost() {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được thay đổi AI model cost.", "error");
    return;
  }
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = null;
  state.selectedTransactionId = null;
  state.selectedAiCostId = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  renderAiCostDrawer({
    id: null,
    provider: state.aiCostProviderFilter || "openai",
    model: state.aiCostModelFilter || "",
    currency: "USD",
    inputCostPerMillion: 0,
    cachedInputCostPerMillion: 0,
    outputCostPerMillion: 0,
    active: true,
    currentlyEffective: false,
    effectiveFrom: null,
    effectiveTo: null,
    notes: ""
  }, true);
}

function renderAiCostDrawer(cost, isCreate) {
  const canEdit = state.admin?.role === "SUPER_ADMIN";
  const disabled = canEdit ? "" : "disabled";
  const status = aiCostStatus(cost);
  $("#drawerTitle").textContent = isCreate ? "Tạo AI model cost" : `${cost.provider} · ${cost.model} · #${cost.id}`;
  $("#drawerBody").innerHTML = `
    <section class="drawer-section plan-section first">
      <div class="section-heading"><div><span class="eyebrow">MODEL COST</span><h3>${isCreate ? "Cost configuration mới" : `Cost #${cost.id}`}</h3></div><span class="status-badge ${status.kind}">${status.label}</span></div>
      ${canEdit ? "" : '<div class="notice info">Bạn đang ở chế độ chỉ xem. Chỉ SUPER_ADMIN được thay đổi bảng giá AI.</div>'}
      <div class="form-grid">
        <label><span>Provider</span><input id="aiCostProvider" maxlength="50" value="${escapeHtml(cost.provider || "")}" placeholder="openai" ${disabled} /></label>
        <label><span>Model</span><input id="aiCostModel" maxlength="120" value="${escapeHtml(cost.model || "")}" placeholder="model-id" ${disabled} /></label>
        <label><span>Currency</span><input id="aiCostCurrency" maxlength="3" value="${escapeHtml(cost.currency || "USD")}" placeholder="USD" ${disabled} /></label>
        <label class="toggle-field"><span>Active</span><span class="toggle-line"><input id="aiCostActive" type="checkbox" ${cost.active ? "checked" : ""} ${disabled} /> Active</span></label>
        <label><span>Input / 1M tokens</span><input id="aiCostInput" type="number" min="0" step="0.00000001" value="${escapeHtml(cost.inputCostPerMillion ?? 0)}" ${disabled} /></label>
        <label><span>Cached input / 1M</span><input id="aiCostCached" type="number" min="0" step="0.00000001" value="${escapeHtml(cost.cachedInputCostPerMillion ?? 0)}" ${disabled} /></label>
        <label><span>Output / 1M tokens</span><input id="aiCostOutput" type="number" min="0" step="0.00000001" value="${escapeHtml(cost.outputCostPerMillion ?? 0)}" ${disabled} /></label>
        <div class="price-preview"><span>Đơn vị</span><strong id="aiCostPreview">${escapeHtml(cost.currency || "USD")} / 1M tokens</strong><small>14.8.3 sẽ dùng rate theo thời điểm request</small></div>
      </div>
      <div class="notice info">Cost là chi phí nhà cung cấp AI trên <strong>1.000.000 tokens</strong>, không phải giá bán cho khách hàng.</div>
    </section>
    <section class="drawer-section plan-section">
      <div class="section-heading"><div><span class="eyebrow">EFFECTIVE WINDOW</span><h3>Thời gian hiệu lực</h3></div><small class="muted">Active windows cùng provider/model/currency không được overlap</small></div>
      <div class="form-grid">
        <label><span>Bắt đầu</span><input id="aiCostEffectiveFrom" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(cost.effectiveFrom))}" ${disabled} /></label>
        <label><span>Kết thúc</span><input id="aiCostEffectiveTo" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(cost.effectiveTo))}" ${disabled} /></label>
      </div>
      <label><span>Ghi chú nội bộ</span><textarea id="aiCostNotes" rows="3" maxlength="500" ${disabled}>${escapeHtml(cost.notes || "")}</textarea></label>
      ${canEdit ? `<label><span>Lý do thao tác</span><textarea id="aiCostReason" rows="3" maxlength="500" placeholder="Bắt buộc để ghi audit"></textarea></label>
      <div class="action-row"><button id="saveAiCostButton" class="primary">${isCreate ? "Tạo cost configuration" : "Lưu thay đổi"}</button></div>` : ""}
      ${!isCreate ? `<small class="muted">Created by ${escapeHtml(cost.createdByEmail || `User #${cost.createdByUserId || "system"}`)} · ${fmtDate(cost.createdAt)} · Updated ${fmtDate(cost.updatedAt)}</small>` : ""}
    </section>`;

  if (!canEdit) return;

  const updatePreview = () => {
    $("#aiCostPreview").textContent = `${String($("#aiCostCurrency").value || "USD").toUpperCase()} / 1M tokens`;
  };
  $("#aiCostCurrency").addEventListener("input", updatePreview);
  $("#saveAiCostButton").addEventListener("click", async () => {
    const provider = $("#aiCostProvider").value.trim();
    const model = $("#aiCostModel").value.trim();
    const currency = $("#aiCostCurrency").value.trim().toUpperCase();
    const reason = $("#aiCostReason").value.trim();
    if (!provider || !model || !currency || !reason) {
      toast("Provider, model, currency và lý do là bắt buộc.", "error");
      return;
    }
    const body = {
      provider,
      model,
      currency,
      inputCostPerMillion: Number($("#aiCostInput").value),
      cachedInputCostPerMillion: Number($("#aiCostCached").value),
      outputCostPerMillion: Number($("#aiCostOutput").value),
      active: $("#aiCostActive").checked,
      effectiveFrom: localDateTimeToIso($("#aiCostEffectiveFrom").value),
      effectiveTo: localDateTimeToIso($("#aiCostEffectiveTo").value),
      notes: $("#aiCostNotes").value.trim() || null,
      reason
    };
    if ([body.inputCostPerMillion, body.cachedInputCostPerMillion, body.outputCostPerMillion].some((value) => !Number.isFinite(value) || value < 0)) {
      toast("Các mức cost phải là số không âm.", "error");
      return;
    }
    try {
      const saved = await api(isCreate ? "/api/v1/admin/ai-model-costs" : `/api/v1/admin/ai-model-costs/${cost.id}`, {
        method: isCreate ? "POST" : "PUT",
        body: JSON.stringify(body)
      });
      state.selectedAiCostId = saved.id;
      toast(isCreate ? "Đã tạo AI model cost." : "Đã cập nhật AI model cost.", "success");
      renderAiCostDrawer(saved, false);
      await loadAiCosts();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}


const fxRateStatus = (rate) => {
  if (rate.currentlyEffective) return { label: "EFFECTIVE", kind: "ok" };
  if (!rate.active) return { label: "INACTIVE", kind: "warn" };
  const now = Date.now();
  const from = rate.effectiveFrom ? new Date(rate.effectiveFrom).getTime() : null;
  const to = rate.effectiveTo ? new Date(rate.effectiveTo).getTime() : null;
  if (from != null && from > now) return { label: "SCHEDULED", kind: "info" };
  if (to != null && to <= now) return { label: "EXPIRED", kind: "warn" };
  return { label: "NOT LIVE", kind: "warn" };
};

const marginMetric = (label, value, hint, muted = false) => `<article class="metric-card ${muted ? "metric-muted" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`;

const fmtMarginMoney = (value, currency, available = true) => available ? fmtCost(value, currency) : "Chưa tính được";

function renderMarginBreakdown(title, rows = [], currency = "USD") {
  return `<div class="card-heading"><div><span class="eyebrow">MARGIN BREAKDOWN</span><h3>${escapeHtml(title)}</h3></div></div>
    ${rows.length ? `<div class="margin-breakdown-list">${rows.map((row) => `
      <div class="margin-breakdown-row">
        <div><strong>${escapeHtml(row.label || row.key)}</strong><small>${fmtNumber(row.revenueEvents)} revenue events · ${fmtNumber(row.aiEvents)} AI calls</small></div>
        <div><span>Net revenue</span><strong>${escapeHtml(fmtCost(row.netRevenue, currency))}</strong></div>
        <div><span>AI cost</span><strong>${escapeHtml(fmtCost(row.aiCost, currency))}</strong></div>
        <div><span>Gross profit</span><strong>${escapeHtml(fmtMarginMoney(row.grossProfit, currency, row.marginAvailable))}</strong><small>${row.marginAvailable && row.grossMarginPercent != null ? fmtPercent(row.grossMarginPercent) : "coverage incomplete"}</small></div>
      </div>`).join("")}</div>` : '<div class="empty">Chưa có dữ liệu trong khoảng thời gian này.</div>'}`;
}

async function loadMargin() {
  const safeDays = [1, 7, 30].includes(Number(state.marginDays)) ? Number(state.marginDays) : 7;
  state.marginDays = safeDays;
  $("#marginDays").value = String(safeDays);

  const params = new URLSearchParams();
  if (state.fxBaseFilter) params.set("baseCurrency", state.fxBaseFilter);
  if (state.fxQuoteFilter) params.set("quoteCurrency", state.fxQuoteFilter);
  if (state.fxActiveFilter) params.set("active", state.fxActiveFilter);
  params.set("limit", "500");

  const [dashboard, fxRates] = await Promise.all([
    api(`/api/v1/admin/margin-dashboard?days=${safeDays}`),
    api(`/api/v1/admin/fx-rates?${params}`)
  ]);
  state.marginDashboard = dashboard;
  state.fxRates = fxRates;
  if (dashboard.analyticsTimeZone) state.adminTimeZone = dashboard.analyticsTimeZone;
  const currency = dashboard.reportingCurrency || "USD";

  const notices = [];
  if (dashboard.missingFxEvents > 0) notices.push(`${fmtNumber(dashboard.missingFxEvents)} revenue event thiếu FX snapshot.`);
  if (dashboard.missingAiCostEvents > 0) notices.push(`${fmtNumber(dashboard.missingAiCostEvents)} AI event chưa tính được cost.`);
  $("#marginNotice").innerHTML = notices.length
    ? `<div class="notice warn"><strong>Margin coverage chưa hoàn chỉnh.</strong> ${escapeHtml(notices.join(" "))} Gross profit không được suy đoán khi thiếu coverage.</div>`
    : `<div class="notice ok"><strong>Margin coverage hoàn chỉnh.</strong> Revenue và AI cost đều đã chuẩn hóa về ${escapeHtml(currency)}.</div>`;

  const revenueComplete = Number(dashboard.revenueCoveragePercent || 0) >= 100;
  const aiComplete = Number(dashboard.aiCostCoveragePercent || 0) >= 100;
  $("#marginMetrics").innerHTML = `
    ${marginMetric(revenueComplete ? "Gross revenue" : "Gross revenue (partial)", fmtCost(dashboard.grossRevenue, currency), `${fmtNumber(dashboard.paidTransactions)} paid transactions`)}
    ${marginMetric(revenueComplete ? "Refunds" : "Refunds (partial)", fmtCost(dashboard.refunds, currency), `${fmtNumber(dashboard.refundTransactions)} refunds`)}
    ${marginMetric(revenueComplete ? "Net revenue" : "Net revenue (partial)", fmtCost(dashboard.netRevenue, currency), `${fmtPercent(dashboard.revenueCoveragePercent)} revenue coverage`, !revenueComplete)}
    ${marginMetric(aiComplete ? "AI Cost" : "AI Cost (partial)", dashboard.aiCostCoveragePercent > 0 ? fmtCost(dashboard.aiCost, currency) : "Chưa tính được", `${fmtPercent(dashboard.aiCostCoveragePercent)} AI cost coverage`, !aiComplete)}
    ${marginMetric("Gross profit", fmtMarginMoney(dashboard.grossProfit, currency, dashboard.marginAvailable), dashboard.marginAvailable && dashboard.grossMarginPercent != null ? `${fmtPercent(dashboard.grossMarginPercent)} gross margin` : "coverage incomplete", !dashboard.marginAvailable)}
    ${marginMetric("Reporting", currency, `${safeDays} day window · ${dashboard.analyticsTimeZone}`)}
  `;

  $("#marginDaily").innerHTML = `<div class="card-heading"><div><span class="eyebrow">DAILY</span><h3>Revenue / Cost / Margin</h3></div></div>
    <div class="margin-daily-list">${(dashboard.daily || []).map((row) => `<div class="margin-daily-row">
      <strong>${escapeHtml(row.date)}</strong>
      <span>Revenue <b>${escapeHtml(fmtCost(row.netRevenue, currency))}</b></span>
      <span>AI <b>${escapeHtml(fmtCost(row.aiCost, currency))}</b></span>
      <span>Profit <b>${escapeHtml(fmtMarginMoney(row.grossProfit, currency, row.marginAvailable))}</b></span>
      <small>${row.marginAvailable && row.grossMarginPercent != null ? fmtPercent(row.grossMarginPercent) : "coverage incomplete"}</small>
    </div>`).join("")}</div>`;
  $("#marginByPlan").innerHTML = renderMarginBreakdown("Theo plan", dashboard.plans || [], currency);
  $("#marginByUser").innerHTML = renderMarginBreakdown("Theo user", dashboard.users || [], currency);

  const effective = fxRates.filter((rate) => rate.currentlyEffective).length;
  const scheduled = fxRates.filter((rate) => fxRateStatus(rate).label === "SCHEDULED").length;
  $("#fxMetrics").innerHTML = `
    ${metric("FX records", fxRates.length, "versioned rates")}
    ${metric("Đang hiệu lực", effective, "EFFECTIVE")}
    ${metric("Đã lên lịch", scheduled, "SCHEDULED")}
    ${marginMetric("Reporting currency", currency, "normalized target")}
  `;

  $("#createFxRateButton").disabled = state.admin?.role !== "SUPER_ADMIN";
  $("#backfillRevenueButton").disabled = state.admin?.role !== "SUPER_ADMIN";
  $("#fxRatesTable").innerHTML = fxRates.length ? `<table><thead><tr><th>Currency pair</th><th>Rate</th><th>Hiệu lực</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${fxRates.map((rate) => {
    const status = fxRateStatus(rate);
    return `<tr class="clickable" data-fx-rate-id="${rate.id}">
      <td><strong>${escapeHtml(rate.baseCurrency)} → ${escapeHtml(rate.quoteCurrency)}</strong><small>#${rate.id}</small></td>
      <td><strong class="mono-value">${escapeHtml(String(rate.rate))}</strong><small>1 ${escapeHtml(rate.baseCurrency)} = rate ${escapeHtml(rate.quoteCurrency)}</small></td>
      <td><span>${fmtDate(rate.effectiveFrom)}</span><small>→ ${rate.effectiveTo ? fmtDate(rate.effectiveTo) : "Không giới hạn"}</small></td>
      <td><span class="status-badge ${status.kind}">${status.label}</span></td>
      <td>${escapeHtml(rate.notes || "—")}</td>
    </tr>`;
  }).join("")}</tbody></table>` : '<div class="empty large">Chưa có FX rate cho bộ lọc này. Cùng currency không cần cấu hình vì hệ thống tự dùng rate 1.</div>';
  $$('[data-fx-rate-id]').forEach((row) => row.addEventListener("click", () => void openFxRate(Number(row.dataset.fxRateId))));
}

async function openFxRate(rateId) {
  state.selectedFxRateId = rateId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải FX rate...</div>';
  try {
    const rate = await api(`/api/v1/admin/fx-rates/${rateId}`);
    renderFxRateDrawer(rate, false);
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

function openCreateFxRate() {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được thay đổi FX rate.", "error");
    return;
  }
  state.selectedFxRateId = null;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  renderFxRateDrawer({
    id: null,
    baseCurrency: state.fxBaseFilter || "VND",
    quoteCurrency: state.marginDashboard?.reportingCurrency || "USD",
    rate: "",
    active: true,
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
    notes: ""
  }, true);
}

function renderFxRateDrawer(rate, isCreate) {
  const canEdit = state.admin?.role === "SUPER_ADMIN";
  const disabled = canEdit ? "" : "disabled";
  const status = fxRateStatus(rate);
  $("#drawerTitle").textContent = isCreate ? "Tạo FX rate" : `${rate.baseCurrency} → ${rate.quoteCurrency} · #${rate.id}`;
  $("#drawerBody").innerHTML = `<section class="drawer-section plan-section first">
    <div class="section-heading"><div><span class="eyebrow">FX SNAPSHOT SOURCE</span><h3>${isCreate ? "FX rate mới" : `FX rate #${rate.id}`}</h3></div><span class="status-badge ${status.kind}">${status.label}</span></div>
    ${canEdit ? "" : '<div class="notice info">Chỉ SUPER_ADMIN được thay đổi FX rate.</div>'}
    <div class="form-grid">
      <label><span>Base currency</span><input id="fxBaseCurrency" maxlength="3" value="${escapeHtml(rate.baseCurrency || "VND")}" ${disabled} /></label>
      <label><span>Quote / reporting currency</span><input id="fxQuoteCurrency" maxlength="3" value="${escapeHtml(rate.quoteCurrency || state.marginDashboard?.reportingCurrency || "USD")}" ${disabled} /></label>
      <label><span>Rate</span><input id="fxRateValue" type="number" min="0.000000000001" step="0.000000000001" value="${escapeHtml(rate.rate ?? "")}" ${disabled} /></label>
      <label class="toggle-field"><span>Active</span><span class="toggle-line"><input id="fxRateActive" type="checkbox" ${rate.active ? "checked" : ""} ${disabled} /> Active</span></label>
      <label><span>Bắt đầu</span><input id="fxEffectiveFrom" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(rate.effectiveFrom))}" ${disabled} /></label>
      <label><span>Kết thúc</span><input id="fxEffectiveTo" type="datetime-local" value="${escapeHtml(toLocalDateTimeValue(rate.effectiveTo))}" ${disabled} /></label>
    </div>
    <div class="notice info">Ví dụ VND → USD: nhập số USD tương ứng với <strong>1 VND</strong>. Payment sẽ snapshot rate tại thời điểm settle; sửa rate sau này không làm đổi revenue lịch sử đã NORMALIZED.</div>
    <label><span>Ghi chú nội bộ</span><textarea id="fxNotes" rows="3" maxlength="500" ${disabled}>${escapeHtml(rate.notes || "")}</textarea></label>
    ${canEdit ? `<label><span>Lý do thao tác</span><textarea id="fxReason" rows="3" maxlength="500" placeholder="Bắt buộc để ghi audit"></textarea></label><div class="action-row"><button id="saveFxRateButton" class="primary">${isCreate ? "Tạo FX rate" : "Lưu thay đổi"}</button></div>` : ""}
    ${!isCreate ? `<small class="muted">Created by ${escapeHtml(rate.createdByEmail || `User #${rate.createdByUserId || "system"}`)} · ${fmtDate(rate.createdAt)} · Updated ${fmtDate(rate.updatedAt)}</small>` : ""}
  </section>`;

  if (!canEdit) return;
  $("#saveFxRateButton").addEventListener("click", async () => {
    const body = {
      baseCurrency: $("#fxBaseCurrency").value.trim().toUpperCase(),
      quoteCurrency: $("#fxQuoteCurrency").value.trim().toUpperCase(),
      rate: Number($("#fxRateValue").value),
      active: $("#fxRateActive").checked,
      effectiveFrom: localDateTimeToIso($("#fxEffectiveFrom").value),
      effectiveTo: localDateTimeToIso($("#fxEffectiveTo").value),
      notes: $("#fxNotes").value.trim() || null,
      reason: $("#fxReason").value.trim()
    };
    if (!/^[A-Z]{3}$/.test(body.baseCurrency) || !/^[A-Z]{3}$/.test(body.quoteCurrency) || !Number.isFinite(body.rate) || body.rate <= 0 || !body.reason) {
      toast("Currency, FX rate > 0 và lý do là bắt buộc.", "error");
      return;
    }
    try {
      const saved = await api(isCreate ? "/api/v1/admin/fx-rates" : `/api/v1/admin/fx-rates/${rate.id}`, {
        method: isCreate ? "POST" : "PUT",
        body: JSON.stringify(body)
      });
      state.selectedFxRateId = saved.id;
      toast(isCreate ? "Đã tạo FX rate." : "Đã cập nhật FX rate.", "success");
      renderFxRateDrawer(saved, false);
      await loadMargin();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}


function securitySeverityClass(severity) {
  if (severity === "CRITICAL") return "critical";
  if (severity === "WARNING") return "warn";
  return "ok";
}

function securityOutcomeClass(outcome) {
  if (outcome === "SUCCESS") return "ok";
  if (outcome === "DENIED") return "warn";
  return "critical";
}

function securityActorLabel(event) {
  if (event.actorEmail) return event.actorEmail;
  if (event.attemptedEmail) return event.attemptedEmail;
  if (event.actorUserId) return `User #${event.actorUserId}`;
  return "Anonymous / unknown";
}

function securityTargetLabel(event) {
  if (event.targetEmail) return event.targetEmail;
  if (event.targetUserId) return `User #${event.targetUserId}`;
  return "—";
}

async function loadSecurity() {
  const params = new URLSearchParams();
  params.set("days", String(state.securityDays || 7));
  params.set("limit", "300");
  if (state.securitySeverity) params.set("severity", state.securitySeverity);
  if (state.securityOutcome) params.set("outcome", state.securityOutcome);
  if (state.securityCategory) params.set("category", state.securityCategory);
  if (state.securityEventType) params.set("eventType", state.securityEventType);
  if (state.securityQuery) params.set("query", state.securityQuery);

  const data = await api(`/api/v1/admin/security-events?${params.toString()}`);
  state.securityDashboard = data;
  if (data.summary?.timeZone) state.adminTimeZone = data.summary.timeZone;

  $("#securityDays").value = String(state.securityDays || 7);
  $("#securitySeverity").value = state.securitySeverity;
  $("#securityOutcome").value = state.securityOutcome;
  $("#securityCategory").value = state.securityCategory;
  $("#securityEventType").value = state.securityEventType;
  $("#securityQuery").value = state.securityQuery;

  const summary = data.summary || {};
  $("#securityMetrics").innerHTML = `
    ${metric("Security events", summary.totalEvents, `${state.securityDays} day window`)}
    ${metric("Login success", summary.loginSuccess, "Admin authentication")}
    ${metric("Login failed", summary.loginFailure, "Denied login attempts")}
    ${metric("Access denied", summary.deniedAccess, "401 / 403 admin access")}
    ${metric("Admin actions", summary.sensitiveActions, "Audited sensitive writes")}
    ${metric("Warnings", Number(summary.warningEvents || 0) + Number(summary.criticalEvents || 0), `${fmtNumber(summary.criticalEvents || 0)} critical`)}
  `;

  renderSecurityEvents(data.events || []);
}

function renderSecurityEvents(events) {
  const target = $("#securityEventsTable");
  if (!events.length) {
    target.innerHTML = '<div class="empty large">Không có security event phù hợp bộ lọc.</div>';
    return;
  }

  target.innerHTML = `
    <table class="security-table">
      <thead><tr><th>Time / Event</th><th>Actor</th><th>Request</th><th>Severity</th><th>Outcome</th></tr></thead>
      <tbody>${events.map((event) => `
        <tr class="clickable" data-security-event-id="${event.id}">
          <td><strong>${escapeHtml(event.eventType)}</strong><small>${escapeHtml(event.category)} · ${fmtDate(event.createdAt)}</small></td>
          <td><strong>${escapeHtml(securityActorLabel(event))}</strong><small>${escapeHtml(event.actorRole || "—")}${event.targetUserId ? ` → ${escapeHtml(securityTargetLabel(event))}` : ""}</small></td>
          <td><strong class="mono-value">${escapeHtml(event.requestId || "—")}</strong><small>${escapeHtml([event.httpMethod, event.requestPath].filter(Boolean).join(" ") || "—")}</small></td>
          <td><span class="status-badge ${securitySeverityClass(event.severity)}">${escapeHtml(event.severity)}</span></td>
          <td><span class="status-badge ${securityOutcomeClass(event.outcome)}">${escapeHtml(event.outcome)}</span></td>
        </tr>`).join("")}</tbody>
    </table>`;

  $$('[data-security-event-id]').forEach((row) => row.addEventListener("click", () => {
    openSecurityEvent(Number(row.dataset.securityEventId));
  }));
}

function openSecurityEvent(eventId) {
  const event = (state.securityDashboard?.events || []).find((item) => Number(item.id) === Number(eventId));
  if (!event) return;

  state.selectedSecurityEventId = eventId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = `${event.eventType} · #${event.id}`;
  $("#drawerBody").innerHTML = `
    <section class="drawer-section first security-event-detail">
      <div class="section-heading"><div><span class="eyebrow">SECURITY EVENT</span><h3>${escapeHtml(event.category)}</h3></div><div class="security-badges"><span class="status-badge ${securitySeverityClass(event.severity)}">${escapeHtml(event.severity)}</span><span class="status-badge ${securityOutcomeClass(event.outcome)}">${escapeHtml(event.outcome)}</span></div></div>
      <div class="detail-grid">
        <div><span>Created</span><strong>${fmtDate(event.createdAt)}</strong><small>${escapeHtml(state.adminTimeZone)}</small></div>
        <div><span>Actor</span><strong>${escapeHtml(securityActorLabel(event))}</strong><small>${escapeHtml(event.actorRole || "—")}${event.actorUserId ? ` · #${event.actorUserId}` : ""}</small></div>
        <div><span>Target</span><strong>${escapeHtml(securityTargetLabel(event))}</strong><small>${event.targetUserId ? `#${event.targetUserId}` : "No target user"}</small></div>
        <div><span>Attempted email</span><strong>${escapeHtml(event.attemptedEmail || "—")}</strong><small>Login metadata only</small></div>
      </div>
    </section>
    <section class="drawer-section security-event-detail">
      <div class="section-heading"><div><span class="eyebrow">REQUEST METADATA</span><h3>Request context</h3></div></div>
      <div class="detail-grid">
        <div><span>Request ID</span><strong class="mono-value">${escapeHtml(event.requestId || "—")}</strong></div>
        <div><span>Method</span><strong>${escapeHtml(event.httpMethod || "—")}</strong></div>
        <div><span>Path</span><strong class="mono-value">${escapeHtml(event.requestPath || "—")}</strong></div>
        <div><span>Remote IP</span><strong class="mono-value">${escapeHtml(event.remoteIp || "—")}</strong></div>
        <div><span>X-Forwarded-For</span><strong class="mono-value">${escapeHtml(event.forwardedFor || "—")}</strong><small>Không được coi là trusted client IP nếu proxy chưa được cấu hình.</small></div>
        <div><span>User-Agent</span><strong class="mono-value">${escapeHtml(event.userAgent || "—")}</strong></div>
      </div>
    </section>
    <section class="drawer-section security-event-detail">
      <div class="section-heading"><div><span class="eyebrow">DETAILS</span><h3>Security metadata</h3></div></div>
      <div class="notice info mono-value">${escapeHtml(event.details || "No additional details")}</div>
      <small class="muted">Security ledger không lưu password, JWT, request body, prompt, OCR hoặc nội dung dịch.</small>
    </section>`;
}


function requireReason() {
  const reason = $("#actionReason")?.value.trim();
  if (!reason) { toast("Hãy nhập lý do để ghi audit.", "error"); return ""; }
  return reason;
}

async function userAction(path, method, body) {
  try {
    const result = await api(path, { method, body: JSON.stringify(body) });
    toast(result.message || "Đã cập nhật.", "success");
    await openUser(state.selectedUserId);
    if (state.currentView === "users") await loadUsers();
  } catch (error) { toast(error.message, "error"); }
}

function sessionRows(rows) {
  if (!rows.length) return '<div class="empty">Không có session đang hoạt động.</div>';
  return `<div class="compact-list">${rows.map((s) => `<div><strong>${escapeHtml(s.deviceName)}</strong><span>${escapeHtml(s.deviceId)}</span><small>Last: ${fmtDate(s.lastUsedAt)} · Expires: ${fmtDate(s.expiresAt)}</small></div>`).join("")}</div>`;
}

function auditRows(rows, compact = false) {
  if (!rows.length) return '<div class="empty">Chưa có audit log.</div>';
  return `<div class="audit-list ${compact ? "compact" : ""}">${rows.map((a) => `<div class="audit-row"><span class="audit-dot"></span><div><strong>${escapeHtml(a.action)}</strong><span>${escapeHtml(a.actorEmail || `User #${a.actorUserId || "system"}`)}${a.targetEmail ? ` → ${escapeHtml(a.targetEmail)}` : ""}</span><small>${escapeHtml(a.details || "")} · ${fmtDate(a.createdAt)}</small></div></div>`).join("")}</div>`;
}

function auditActorLabel(entry) {
  if (entry.actorEmail) return entry.actorEmail;
  if (entry.actorUserId) return `User #${entry.actorUserId}`;
  return "System / unknown";
}

function auditTargetLabel(entry) {
  if (entry.targetEmail) return entry.targetEmail;
  if (entry.targetUserId) return `User #${entry.targetUserId}`;
  return "—";
}

function auditCategoryClass(category) {
  if (category === "ACCESS") return "access";
  if (category === "BILLING") return "billing";
  if (category === "AI_COST") return "ai-cost";
  if (category === "PLANS") return "plans";
  return "operations";
}

async function loadAudit() {
  const params = new URLSearchParams();
  params.set("days", String(state.auditDays || 7));
  params.set("limit", "300");
  if (state.auditCategory) params.set("category", state.auditCategory);
  if (state.auditAction) params.set("action", state.auditAction);
  if (state.auditActor) params.set("actor", state.auditActor);
  if (state.auditTarget) params.set("target", state.auditTarget);
  if (state.auditQuery) params.set("query", state.auditQuery);

  const data = await api(`/api/v1/admin/audit-dashboard?${params.toString()}`);
  state.auditDashboard = data;
  if (data.summary?.timeZone) state.adminTimeZone = data.summary.timeZone;

  $("#auditDays").value = String(state.auditDays || 7);
  $("#auditCategory").value = state.auditCategory;
  $("#auditAction").value = state.auditAction;
  $("#auditActor").value = state.auditActor;
  $("#auditTarget").value = state.auditTarget;
  $("#auditQuery").value = state.auditQuery;

  const summary = data.summary || {};
  $("#auditMetrics").innerHTML = `
    ${metric("Audit actions", summary.totalActions, `${state.auditDays} day window`)}
    ${metric("Actors", summary.uniqueActors, "unique admin actors")}
    ${metric("Affected users", summary.affectedUsers, "unique target users")}
    ${metric("Access", summary.accessActions, "account / role / session")}
    ${metric("Billing", summary.billingActions, "payment / license / subscription")}
    ${metric("Sensitive", summary.sensitiveActions, "refund / revoke / cancel / backfill")}
  `;

  renderAuditTable(data.entries || []);
}

function renderAuditTable(entries) {
  const target = $("#auditTable");
  if (!entries.length) {
    target.innerHTML = '<div class="empty large">Không có audit log phù hợp bộ lọc.</div>';
    return;
  }

  target.innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">AUDIT TRAIL</span><h3>Thao tác quản trị</h3></div><span class="muted">${entries.length} bản ghi</span></div>
    <table class="audit-table">
      <thead><tr><th>Time / Action</th><th>Actor → Target</th><th>Request</th><th>Category</th></tr></thead>
      <tbody>${entries.map((entry) => `
        <tr class="clickable" data-audit-id="${entry.id}">
          <td><strong>${escapeHtml(entry.action)}</strong><small>#${entry.id} · ${fmtDate(entry.createdAt)}</small></td>
          <td><strong>${escapeHtml(auditActorLabel(entry))}</strong><small>${escapeHtml(entry.actorRole || "role unavailable")}${entry.targetUserId ? ` · → ${escapeHtml(auditTargetLabel(entry))}` : " · No target user"}</small></td>
          <td><strong class="mono-value">${escapeHtml(entry.requestId || "Legacy / unavailable")}</strong><small>${escapeHtml([entry.httpMethod, entry.requestPath].filter(Boolean).join(" ") || "No request metadata")}</small></td>
          <td><span class="audit-category ${auditCategoryClass(entry.category)}">${escapeHtml(entry.category || "OPERATIONS")}</span></td>
        </tr>`).join("")}</tbody>
    </table>`;

  $$('[data-audit-id]').forEach((row) => row.addEventListener("click", () => {
    openAuditEntry(Number(row.dataset.auditId));
  }));
}

function openAuditEntry(auditId) {
  const entry = (state.auditDashboard?.entries || []).find((item) => Number(item.id) === Number(auditId));
  if (!entry) return;

  state.selectedAuditId = auditId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = `${entry.action} · #${entry.id}`;
  $("#drawerBody").innerHTML = `
    <section class="drawer-section first audit-entry-detail">
      <div class="section-heading"><div><span class="eyebrow">AUDIT ENTRY</span><h3>${escapeHtml(entry.action)}</h3></div><span class="audit-category ${auditCategoryClass(entry.category)}">${escapeHtml(entry.category || "OPERATIONS")}</span></div>
      <div class="detail-grid">
        <div><span>Created</span><strong>${fmtDate(entry.createdAt)}</strong><small>${escapeHtml(state.adminTimeZone)}</small></div>
        <div><span>Actor</span><strong>${escapeHtml(auditActorLabel(entry))}</strong><small>${escapeHtml(entry.actorRole || "role unavailable")}${entry.actorUserId ? ` · User #${entry.actorUserId}` : " · System / unknown"}</small></div>
        <div><span>Target</span><strong>${escapeHtml(auditTargetLabel(entry))}</strong><small>${entry.targetUserId ? `User #${entry.targetUserId}` : "No target user"}</small></div>
        <div><span>Audit ID</span><strong class="mono-value">#${entry.id}</strong></div>
      </div>
    </section>
    <section class="drawer-section audit-entry-detail">
      <div class="section-heading"><div><span class="eyebrow">REQUEST METADATA</span><h3>Trace context</h3></div></div>
      <div class="detail-grid">
        <div><span>Request ID</span><strong class="mono-value">${escapeHtml(entry.requestId || "—")}</strong></div>
        <div><span>Method</span><strong>${escapeHtml(entry.httpMethod || "—")}</strong></div>
        <div><span>Path</span><strong class="mono-value">${escapeHtml(entry.requestPath || "—")}</strong></div>
        <div><span>Remote IP</span><strong class="mono-value">${escapeHtml(entry.remoteIp || "—")}</strong></div>
        <div><span>X-Forwarded-For</span><strong class="mono-value">${escapeHtml(entry.forwardedFor || "—")}</strong><small>Chỉ đáng tin khi reverse proxy được cấu hình đúng.</small></div>
        <div class="full"><span>User-Agent</span><strong class="mono-value">${escapeHtml(entry.userAgent || "—")}</strong></div>
      </div>
      ${entry.requestId ? "" : '<div class="notice info">Bản ghi này được tạo trước 14.9.2 hoặc ngoài HTTP request nên chưa có request metadata.</div>'}
    </section>
    <section class="drawer-section audit-entry-detail">
      <div class="section-heading"><div><span class="eyebrow">DETAILS</span><h3>Audit reason / metadata</h3></div></div>
      <div class="notice info mono-value">${escapeHtml(entry.details || "No additional details")}</div>
      <small class="muted">Audit log không lưu password, JWT, request body, prompt, OCR hoặc nội dung dịch.</small>
    </section>`;
}


function safetyModeClass(mode) {
  return mode === "READ_ONLY" ? "warn" : "ok";
}

async function loadSafety() {
  const data = await api("/api/v1/admin/safety");
  state.adminSafety = data;

  const readOnly = Boolean(data.readOnly);
  const mode = String(data.mode || "NORMAL");
  $("#safetyModeBadge").textContent = mode;
  $("#safetyModeBadge").className = `status-pill ${safetyModeClass(mode)}`;

  $("#safetyNotice").innerHTML = readOnly
    ? `<div class="notice warning"><strong>Admin Console đang READ_ONLY.</strong> Các POST / PUT / PATCH / DELETE dưới <span class="mono-value">/api/v1/admin/**</span> đang bị chặn, ngoại trừ login, thay đổi safety mode và acknowledge/resolve incident.</div>`
    : `<div class="notice info"><strong>Admin write mode đang NORMAL.</strong> Guard rails chống tự khóa, tự revoke session và khóa SUPER_ADMIN cuối cùng vẫn luôn hoạt động.</div>`;

  $("#safetyMetrics").innerHTML = `
    ${metricText("Write mode", mode, readOnly ? "writes locked" : "writes enabled")}
    ${metric("Active SUPER_ADMIN", data.activeSuperAdmins, "must remain >= 1")}
    ${metricText("Changed by", data.changedByEmail || (data.changedByUserId ? `User #${data.changedByUserId}` : "System"), data.changedAt ? fmtDate(data.changedAt) : "initial state")}
  `;

  const canChange = state.admin?.role === "SUPER_ADMIN";
  const targetMode = readOnly ? "NORMAL" : "READ_ONLY";
  const actionLabel = readOnly ? "Tắt READ_ONLY" : "Bật READ_ONLY";
  const confirmation = readOnly ? "DISABLE READ_ONLY" : "ENABLE READ_ONLY";

  $("#safetyStatePanel").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">CURRENT STATE</span><h3>${escapeHtml(mode)}</h3></div><span class="status-badge ${safetyModeClass(mode)}">${readOnly ? "LOCKED" : "NORMAL"}</span></div>
    <div class="detail-grid safety-detail-grid">
      <div class="full"><span>Reason</span><strong>${escapeHtml(data.reason || "—")}</strong></div>
      <div><span>Changed by</span><strong>${escapeHtml(data.changedByEmail || (data.changedByUserId ? `User #${data.changedByUserId}` : "System"))}</strong></div>
      <div><span>Changed at</span><strong>${data.changedAt ? fmtDate(data.changedAt) : "—"}</strong></div>
    </div>
    <div class="drawer-actions safety-mode-actions">
      ${canChange ? `<button id="changeSafetyModeButton" class="${readOnly ? "primary" : "danger-button"}">${escapeHtml(actionLabel)}</button>` : '<span class="muted">Chỉ SUPER_ADMIN được thay đổi safety mode.</span>'}
    </div>
    ${canChange ? `<small class="muted">Confirmation phrase: <span class="mono-value">${escapeHtml(confirmation)}</span></small>` : ""}
  `;

  $("#safetyPolicyPanel").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">GUARD RAILS</span><h3>Protected operations</h3></div></div>
    <div class="safety-policy-list">
      <div><strong>Self lock</strong><span>Admin không thể suspend chính tài khoản đang dùng.</span></div>
      <div><strong>Self session revoke</strong><span>Admin không thể revoke-all session của chính mình từ Admin Console.</span></div>
      <div><strong>Last SUPER_ADMIN</strong><span>Không thể suspend SUPER_ADMIN hoạt động cuối cùng.</span></div>
      <div><strong>READ_ONLY write lock</strong><span>Chặn create/update/refund/revoke/cancel/backfill và các Admin write endpoint khác.</span></div>
      <div><strong>Incident bypass</strong><span>Acknowledge / Resolve error event vẫn hoạt động trong READ_ONLY để xử lý sự cố.</span></div>
      <div><strong>Audit trail</strong><span>Thay đổi safety mode được ghi Audit Log và Security Events ở mức CRITICAL.</span></div>
    </div>
  `;

  $("#changeSafetyModeButton")?.addEventListener("click", () => void changeSafetyMode(targetMode));
}

async function changeSafetyMode(targetMode) {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được thay đổi Admin safety mode.", "error");
    return;
  }

  const enabling = targetMode === "READ_ONLY";
  const phrase = enabling ? "ENABLE READ_ONLY" : "DISABLE READ_ONLY";
  const reason = window.prompt(
    enabling ? "Lý do bật READ_ONLY:" : "Lý do tắt READ_ONLY:",
    enabling ? "Maintenance / investigate incident" : "Maintenance complete"
  );
  if (!reason?.trim()) return;

  const confirmation = window.prompt(`Nhập chính xác confirmation phrase: ${phrase}`, "");
  if (confirmation === null) return;

  try {
    await api("/api/v1/admin/safety/mode", {
      method: "POST",
      body: JSON.stringify({
        mode: targetMode,
        reason: reason.trim(),
        confirmation: confirmation.trim()
      })
    });
    toast(`Admin safety mode → ${targetMode}`, enabling ? "info" : "success");
    await loadSafety();
  } catch (error) {
    toast(error.message, "error");
  }
}

function errorStatusClass(status) {
  if (status === "RESOLVED") return "ok";
  if (status === "ACKNOWLEDGED") return "info";
  return "warn";
}

async function loadErrors() {
  const params = new URLSearchParams();
  params.set("days", String(state.errorDays || 7));
  params.set("limit", "300");
  if (state.errorStatus) params.set("status", state.errorStatus);
  if (state.errorSeverity) params.set("severity", state.errorSeverity);
  if (state.errorModule) params.set("module", state.errorModule);
  if (state.errorCode) params.set("errorCode", state.errorCode);
  if (state.errorQuery) params.set("query", state.errorQuery);

  const data = await api(`/api/v1/admin/error-events?${params.toString()}`);
  state.errorDashboard = data;
  if (data.summary?.timeZone) state.adminTimeZone = data.summary.timeZone;

  $("#errorDays").value = String(state.errorDays || 7);
  $("#errorStatus").value = state.errorStatus;
  $("#errorSeverity").value = state.errorSeverity;
  $("#errorModule").value = state.errorModule;
  $("#errorCode").value = state.errorCode;
  $("#errorQuery").value = state.errorQuery;

  const summary = data.summary || {};
  $("#errorMetrics").innerHTML = `
    ${metric("Error events", summary.totalEvents, `${state.errorDays} day window`)}
    ${metric("Open", summary.openEvents, "needs investigation")}
    ${metric("Acknowledged", summary.acknowledgedEvents, "being investigated")}
    ${metric("Resolved", summary.resolvedEvents, "closed")}
    ${metric("Critical open", summary.criticalOpenEvents, "open + acknowledged")}
    ${metric("Retryable open", summary.retryableOpenEvents, "candidate for retry")}
  `;

  renderErrorEvents(data.events || []);
}

function renderErrorEvents(events) {
  const target = $("#errorEventsTable");
  if (!events.length) {
    target.innerHTML = '<div class="empty large">Không có error event phù hợp bộ lọc.</div>';
    return;
  }

  target.innerHTML = `
    <table class="errors-table">
      <thead><tr><th>Time / Error</th><th>Module / Request</th><th>Severity</th><th>Status</th><th>Retry</th></tr></thead>
      <tbody>${events.map((event) => `
        <tr class="clickable" data-error-event-id="${event.id}">
          <td><strong>${escapeHtml(event.errorCode)}</strong><small>#${event.id} · ${fmtDate(event.occurredAt)}</small></td>
          <td><strong>${escapeHtml(event.module)}</strong><small class="mono-value">${escapeHtml(event.requestId || event.requestPath || event.exceptionType || "—")}</small></td>
          <td><span class="status-badge ${securitySeverityClass(event.severity)}">${escapeHtml(event.severity)}</span></td>
          <td><span class="status-badge ${errorStatusClass(event.status)}">${escapeHtml(event.status)}</span></td>
          <td><span class="status-badge ${event.retryable ? "info" : "ok"}">${event.retryable ? "YES" : "NO"}</span></td>
        </tr>`).join("")}</tbody>
    </table>`;

  $$('[data-error-event-id]').forEach((row) => row.addEventListener("click", () => {
    void openErrorEvent(Number(row.dataset.errorEventId));
  }));
}

async function openErrorEvent(eventId) {
  state.selectedErrorEventId = eventId;
  $("#drawerBackdrop").classList.remove("hidden");
  $("#userDrawer").classList.remove("hidden");
  $("#drawerTitle").textContent = `Error #${eventId}`;
  $("#drawerBody").innerHTML = '<div class="loading">Đang tải error metadata...</div>';

  try {
    const event = await api(`/api/v1/admin/error-events/${eventId}`);
    $("#drawerTitle").textContent = `${event.errorCode} · #${event.id}`;
    $("#drawerBody").innerHTML = `
      <section class="drawer-section first error-entry-detail">
        <div class="section-heading"><div><span class="eyebrow">ERROR EVENT</span><h3>${escapeHtml(event.summary)}</h3></div><div class="security-badges"><span class="status-badge ${securitySeverityClass(event.severity)}">${escapeHtml(event.severity)}</span><span class="status-badge ${errorStatusClass(event.status)}">${escapeHtml(event.status)}</span></div></div>
        <div class="detail-grid">
          <div><span>Occurred</span><strong>${fmtDate(event.occurredAt)}</strong><small>${escapeHtml(state.adminTimeZone)}</small></div>
          <div><span>Module</span><strong>${escapeHtml(event.module)}</strong><small>${event.retryable ? "Retryable" : "Not marked retryable"}</small></div>
          <div><span>Error code</span><strong class="mono-value">${escapeHtml(event.errorCode)}</strong></div>
          <div><span>Exception</span><strong class="mono-value">${escapeHtml(event.exceptionType || "—")}</strong></div>
          <div><span>Actor</span><strong>${escapeHtml(event.actorEmail || (event.actorUserId ? `User #${event.actorUserId}` : "System / unknown"))}</strong></div>
          <div><span>HTTP status</span><strong>${escapeHtml(event.httpStatus ?? "—")}</strong></div>
        </div>
      </section>
      <section class="drawer-section error-entry-detail">
        <div class="section-heading"><div><span class="eyebrow">TRACE CONTEXT</span><h3>Request metadata</h3></div></div>
        <div class="detail-grid">
          <div><span>Request ID</span><strong class="mono-value">${escapeHtml(event.requestId || "—")}</strong></div>
          <div><span>Method</span><strong>${escapeHtml(event.httpMethod || "—")}</strong></div>
          <div><span>Path</span><strong class="mono-value">${escapeHtml(event.requestPath || "—")}</strong></div>
          <div><span>Remote IP</span><strong class="mono-value">${escapeHtml(event.remoteIp || "—")}</strong></div>
          <div><span>X-Forwarded-For</span><strong class="mono-value">${escapeHtml(event.forwardedFor || "—")}</strong></div>
          <div><span>User-Agent</span><strong class="mono-value">${escapeHtml(event.userAgent || "—")}</strong></div>
        </div>
      </section>
      <section class="drawer-section error-entry-detail">
        <div class="section-heading"><div><span class="eyebrow">INCIDENT STATE</span><h3>Investigation lifecycle</h3></div></div>
        <div class="detail-grid">
          <div><span>Acknowledged by</span><strong>${escapeHtml(event.acknowledgedByEmail || (event.acknowledgedByUserId ? `User #${event.acknowledgedByUserId}` : "—"))}</strong><small>${fmtDate(event.acknowledgedAt)}</small></div>
          <div><span>Resolved by</span><strong>${escapeHtml(event.resolvedByEmail || (event.resolvedByUserId ? `User #${event.resolvedByUserId}` : "—"))}</strong><small>${fmtDate(event.resolvedAt)}</small></div>
          <div class="full"><span>Acknowledgement note</span><strong>${escapeHtml(event.acknowledgementNote || "—")}</strong></div>
          <div class="full"><span>Resolution note</span><strong>${escapeHtml(event.resolutionNote || "—")}</strong></div>
        </div>
        <div class="drawer-actions">
          ${event.status === "OPEN" ? '<button id="ackErrorEventButton" class="ghost">Acknowledge</button>' : ""}
          ${event.status !== "RESOLVED" ? '<button id="resolveErrorEventButton" class="primary">Resolve</button>' : ""}
        </div>
        <small class="muted">Error ledger chỉ lưu metadata; không lưu password, JWT, request body, prompt, OCR hoặc nội dung dịch.</small>
      </section>`;

    $("#ackErrorEventButton")?.addEventListener("click", () => void updateErrorEvent(event.id, "acknowledge"));
    $("#resolveErrorEventButton")?.addEventListener("click", () => void updateErrorEvent(event.id, "resolve"));
  } catch (error) {
    $("#drawerBody").innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
  }
}

async function updateErrorEvent(eventId, action) {
  const label = action === "resolve" ? "resolution" : "acknowledgement";
  const reason = window.prompt(`Nhập ${label} note để ghi audit:`);
  if (!reason?.trim()) return;
  try {
    await api(`/api/v1/admin/error-events/${eventId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() })
    });
    toast(action === "resolve" ? "Đã resolve error event." : "Đã acknowledge error event.", "success");
    await loadErrors();
    await openErrorEvent(eventId);
  } catch (error) {
    toast(error.message, "error");
  }
}

function fmtBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${fmtNumber(bytes)} B`;
  if (bytes < 1024 ** 2) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / (1024 ** 2))} MB`;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(bytes / (1024 ** 3))} GB`;
}

function fmtDuration(secondsValue) {
  let seconds = Math.max(0, Number(secondsValue || 0));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function healthStatusClass(status) {
  if (status === "CRITICAL") return "critical";
  if (status === "WARNING") return "warn";
  return "ok";
}

function healthStatusBadge(status) {
  return `<span class="status-badge ${healthStatusClass(status)}">${escapeHtml(status || "UNKNOWN")}</span>`;
}

async function loadOperationalHealth() {
  const data = await api("/api/v1/admin/operational-health");
  state.operationalHealth = data;

  $("#healthGeneratedAt").textContent = data.generatedAt ? `Snapshot ${fmtDate(data.generatedAt)}` : "Snapshot";
  $("#healthNotice").innerHTML = data.status === "HEALTHY"
    ? '<div class="notice info health-notice">Không có cảnh báo vận hành nổi bật trong snapshot hiện tại.</div>'
    : `<div class="notice ${data.status === "CRITICAL" ? "warn" : "warn"} health-notice"><strong>${escapeHtml(data.status)}</strong> · Có check cần chú ý. Xem bảng Health checks bên dưới.</div>`;

  $("#healthMetrics").innerHTML = `
    ${healthMetric("Overall", data.status, `${data.liveness || "?"} live · ${data.readiness || "?"} ready`, data.status)}
    ${healthMetric("Uptime", fmtDuration(data.uptimeSeconds), "backend process", "HEALTHY")}
    ${healthMetric("DB latency", `${fmtNumber(data.database?.latencyMs)} ms`, data.database?.reachable ? "reachable" : "unreachable", data.database?.reachable ? (Number(data.database?.latencyMs || 0) >= 500 ? "WARNING" : "HEALTHY") : "CRITICAL")}
    ${healthMetric("HTTP 5xx", fmtPercent(data.http?.serverErrorRatePercent), `${fmtNumber(data.http?.serverErrorsSinceStart)} / ${fmtNumber(data.http?.requestsSinceStart)} since start`, Number(data.http?.requestsSinceStart || 0) >= 20 && Number(data.http?.serverErrorRatePercent || 0) >= 5 ? "WARNING" : "HEALTHY")}
    ${healthMetric("Heap", fmtPercent(data.jvm?.heapUsagePercent), `${fmtBytes(data.jvm?.heapUsedBytes)} / ${fmtBytes(data.jvm?.heapMaxBytes)}`, Number(data.jvm?.heapUsagePercent || 0) >= 85 ? "WARNING" : "HEALTHY")}
    ${healthMetric("AI cost coverage", fmtPercent(data.ai?.costCoveragePercent), `${fmtNumber(data.ai?.missingCost24h)} missing · 24h`, Number(data.ai?.missingCost24h || 0) > 0 ? "WARNING" : "HEALTHY")}
  `;

  $("#healthPlatform").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">PLATFORM</span><h3>Backend / Database</h3></div>${healthStatusBadge(data.database?.reachable ? "HEALTHY" : "CRITICAL")}</div>
    <div class="health-detail-grid">
      <div><span>Liveness</span><strong>${escapeHtml(data.liveness || "—")}</strong></div>
      <div><span>Readiness</span><strong>${escapeHtml(data.readiness || "—")}</strong></div>
      <div><span>DB version</span><strong>${escapeHtml(data.database?.version || "—")}</strong></div>
      <div><span>Flyway</span><strong>${escapeHtml(data.database?.latestMigrationVersion ? `V${data.database.latestMigrationVersion}` : "—")}</strong><small>${escapeHtml(data.database?.latestMigrationDescription || "")}</small></div>
      <div><span>Failed migrations</span><strong>${fmtNumber(data.database?.failedMigrations)}</strong></div>
      <div><span>CPU available</span><strong>${fmtNumber(data.jvm?.availableProcessors)}</strong></div>
      <div><span>HTTP avg latency</span><strong>${fmtLatency(data.http?.averageLatencyMs)}</strong></div>
      <div><span>HTTP 4xx</span><strong>${fmtNumber(data.http?.clientErrorsSinceStart)}</strong><small>since backend start</small></div>
    </div>`;

  $("#healthAi").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">AI · 24H</span><h3>AI reliability</h3></div>${healthStatusBadge(Number(data.ai?.missingCost24h || 0) > 0 ? "WARNING" : "HEALTHY")}</div>
    <div class="health-detail-grid">
      <div><span>Requests</span><strong>${fmtNumber(data.ai?.requests24h)}</strong></div>
      <div><span>Failed</span><strong>${fmtNumber(data.ai?.failed24h)}</strong></div>
      <div><span>Success rate</span><strong>${fmtPercent(data.ai?.successRatePercent)}</strong></div>
      <div><span>Cost coverage</span><strong>${fmtPercent(data.ai?.costCoveragePercent)}</strong></div>
      <div><span>Calculated</span><strong>${fmtNumber(data.ai?.calculatedCost24h)}</strong></div>
      <div><span>Missing cost</span><strong>${fmtNumber(data.ai?.missingCost24h)}</strong></div>
    </div>`;

  $("#healthRevenue").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">PAYMENTS · 24H</span><h3>Revenue pipeline</h3></div>${healthStatusBadge(Number(data.revenue?.missingRevenue24h || 0) > 0 ? "WARNING" : "HEALTHY")}</div>
    <div class="health-detail-grid">
      <div><span>Paid</span><strong>${fmtNumber(data.revenue?.paidTransactions24h)}</strong></div>
      <div><span>Failed</span><strong>${fmtNumber(data.revenue?.failedTransactions24h)}</strong></div>
      <div><span>Normalized</span><strong>${fmtNumber(data.revenue?.normalizedRevenue24h)}</strong></div>
      <div><span>Missing FX</span><strong>${fmtNumber(data.revenue?.missingRevenue24h)}</strong></div>
      <div class="full"><span>Revenue coverage</span><strong>${fmtPercent(data.revenue?.revenueCoveragePercent)}</strong></div>
    </div>`;

  $("#healthSecurity").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">SECURITY · 24H</span><h3>Security signals</h3></div>${healthStatusBadge(Number(data.security?.critical24h || 0) > 0 ? "CRITICAL" : Number(data.security?.warnings24h || 0) > 0 ? "WARNING" : "HEALTHY")}</div>
    <div class="health-detail-grid">
      <div><span>Critical</span><strong>${fmtNumber(data.security?.critical24h)}</strong></div>
      <div><span>Warnings</span><strong>${fmtNumber(data.security?.warnings24h)}</strong></div>
      <div><span>Denied</span><strong>${fmtNumber(data.security?.denied24h)}</strong></div>
      <div><span>Failed logins</span><strong>${fmtNumber(data.security?.failedLogins24h)}</strong></div>
    </div>`;

  $("#healthErrors").innerHTML = `
    <div class="card-heading"><div><span class="eyebrow">ERRORS</span><h3>Open incidents</h3></div>${healthStatusBadge(Number(data.errors?.criticalOpenEvents || 0) > 0 ? "CRITICAL" : Number(data.errors?.openEvents || 0) > 0 ? "WARNING" : "HEALTHY")}</div>
    <div class="health-detail-grid">
      <div><span>Open</span><strong>${fmtNumber(data.errors?.openEvents)}</strong></div>
      <div><span>Critical open</span><strong>${fmtNumber(data.errors?.criticalOpenEvents)}</strong></div>
      <div><span>Retryable</span><strong>${fmtNumber(data.errors?.retryableOpenEvents)}</strong></div>
      <div><span>New · 24h</span><strong>${fmtNumber(data.errors?.newEvents24h)}</strong></div>
    </div>`;

  renderHealthChecks(data.checks || []);
}

function healthMetric(label, value, hint, status) {
  return `<article class="metric-card health-metric ${healthStatusClass(status)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}

function renderHealthChecks(checks) {
  const target = $("#healthChecks");
  if (!checks.length) {
    target.innerHTML = '<div class="empty large">Không có health check.</div>';
    return;
  }
  target.innerHTML = `
    <div class="card-heading health-check-heading"><div><span class="eyebrow">HEALTH CHECKS</span><h3>Operational checks</h3></div><span class="muted">${checks.length} checks</span></div>
    <table class="health-check-table">
      <thead><tr><th>Status</th><th>Check</th><th>Observed</th><th>Detail</th></tr></thead>
      <tbody>${checks.map((check) => `
        <tr>
          <td>${healthStatusBadge(check.status)}</td>
          <td><strong>${escapeHtml(check.title)}</strong><small>${escapeHtml(check.code)}</small></td>
          <td><strong>${escapeHtml(check.observedValue || "—")}</strong></td>
          <td><span>${escapeHtml(check.detail || "")}</span></td>
        </tr>`).join("")}</tbody>
    </table>`;
}

function closeDrawer() {
  $("#drawerBackdrop").classList.add("hidden");
  $("#userDrawer").classList.add("hidden");
  state.selectedUserId = null;
  state.selectedPlanCode = null;
  state.selectedPriceId = null;
  state.selectedLicenseId = null;
  state.selectedTransactionId = null;
  state.selectedAiCostId = null;
  state.selectedFxRateId = null;
  state.selectedAiDrilldown = null;
  state.selectedSecurityEventId = null;
  state.selectedAuditId = null;
  state.selectedErrorEventId = null;
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#loginButton");
  button.disabled = true; button.textContent = "Đang xác thực...";
  $("#loginError").classList.add("hidden");
  try {
    state.backendUrl = validateBackendUrl(
      allowBackendOverride ? $("#backendUrl").value : defaultBackendUrl
    );
    const login = await api("/api/v1/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: $("#email").value.trim(), password: $("#password").value })
    });
    setSession(login);
    $("#password").value = "";
    showApp();
  } catch (error) {
    $("#loginError").textContent = error.message;
    $("#loginError").classList.remove("hidden");
  } finally {
    button.disabled = false; button.textContent = "Đăng nhập Admin";
  }
});


$("#errorDays").addEventListener("change", () => {
  state.errorDays = Number($("#errorDays").value || 7);
  sessionStorage.setItem("ait.admin.errorDays", String(state.errorDays));
  void loadErrors();
});
$("#errorStatus").addEventListener("change", () => { state.errorStatus = $("#errorStatus").value; void loadErrors(); });
$("#errorSeverity").addEventListener("change", () => { state.errorSeverity = $("#errorSeverity").value; void loadErrors(); });
$("#errorModule").addEventListener("change", () => { state.errorModule = $("#errorModule").value; void loadErrors(); });
$("#errorSearchButton").addEventListener("click", () => {
  state.errorCode = $("#errorCode").value.trim().toUpperCase();
  state.errorQuery = $("#errorQuery").value.trim();
  void loadErrors();
});
$("#errorClearButton").addEventListener("click", () => {
  state.errorStatus = "";
  state.errorSeverity = "";
  state.errorModule = "";
  state.errorCode = "";
  state.errorQuery = "";
  void loadErrors();
});
[$("#errorCode"), $("#errorQuery")].forEach((input) => input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("#errorSearchButton").click();
}));


$("#auditDays").addEventListener("change", () => {
  state.auditDays = Number($("#auditDays").value || 7);
  sessionStorage.setItem("ait.admin.auditDays", String(state.auditDays));
  void loadAudit();
});
$("#auditCategory").addEventListener("change", () => { state.auditCategory = $("#auditCategory").value; void loadAudit(); });
$("#auditSearchButton").addEventListener("click", () => {
  state.auditAction = $("#auditAction").value.trim().toUpperCase();
  state.auditActor = $("#auditActor").value.trim();
  state.auditTarget = $("#auditTarget").value.trim();
  state.auditQuery = $("#auditQuery").value.trim();
  void loadAudit();
});
$("#auditClearButton").addEventListener("click", () => {
  state.auditCategory = "";
  state.auditAction = "";
  state.auditActor = "";
  state.auditTarget = "";
  state.auditQuery = "";
  void loadAudit();
});
[$("#auditAction"), $("#auditActor"), $("#auditTarget"), $("#auditQuery")].forEach((input) => input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("#auditSearchButton").click();
}));

$("#securityDays").addEventListener("change", () => {
  state.securityDays = Number($("#securityDays").value || 7);
  sessionStorage.setItem("ait.admin.securityDays", String(state.securityDays));
  void loadSecurity();
});
$("#securitySeverity").addEventListener("change", () => { state.securitySeverity = $("#securitySeverity").value; void loadSecurity(); });
$("#securityOutcome").addEventListener("change", () => { state.securityOutcome = $("#securityOutcome").value; void loadSecurity(); });
$("#securityCategory").addEventListener("change", () => { state.securityCategory = $("#securityCategory").value; void loadSecurity(); });
$("#securitySearchButton").addEventListener("click", () => {
  state.securityEventType = $("#securityEventType").value.trim().toUpperCase();
  state.securityQuery = $("#securityQuery").value.trim();
  void loadSecurity();
});
$("#securityClearButton").addEventListener("click", () => {
  state.securitySeverity = "";
  state.securityOutcome = "";
  state.securityCategory = "";
  state.securityEventType = "";
  state.securityQuery = "";
  void loadSecurity();
});
$("#securityQuery").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("#securitySearchButton").click();
});
$("#securityEventType").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("#securitySearchButton").click();
});

$$(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => void loadView(button.dataset.view)));
$("#refreshButton").addEventListener("click", () => void loadView(state.currentView));
$("#logoutButton").addEventListener("click", () => { clearSession(); showLogin(); });
$("#searchUsersButton").addEventListener("click", () => { state.usersPage = 0; void loadUsers(); });
$("#createPlanButton").addEventListener("click", () => void openCreatePlan());
$("#createPriceButton").addEventListener("click", () => void openCreatePrice());
$("#pricingPlanFilter").addEventListener("change", () => { state.pricePlanFilter = $("#pricingPlanFilter").value; void loadPricing(); });
$("#createLicenseButton").addEventListener("click", () => void openCreateLicense());
$("#licensePlanFilter").addEventListener("change", () => { state.licensePlanFilter = $("#licensePlanFilter").value; void loadLicenses(); });
$("#licenseStatusFilter").addEventListener("change", () => { state.licenseStatusFilter = $("#licenseStatusFilter").value; void loadLicenses(); });
$("#createTransactionButton").addEventListener("click", () => void openCreateTransaction());
$("#transactionStatusFilter").addEventListener("change", () => { state.transactionStatusFilter = $("#transactionStatusFilter").value; void loadTransactions(); });
$("#transactionPlanFilter").addEventListener("change", () => { state.transactionPlanFilter = $("#transactionPlanFilter").value; void loadTransactions(); });
$("#aiDashboardDays").addEventListener("change", () => {
  state.aiDashboardDays = Number($("#aiDashboardDays").value || 7);
  sessionStorage.setItem("ait.admin.aiCostDays", String(state.aiDashboardDays));
  void loadAiCosts();
});
$("#backfillAiCostsButton").addEventListener("click", async () => {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được backfill AI cost.", "error");
    return;
  }
  const reason = window.prompt("Lý do backfill AI cost:", "Backfill missing model rates");
  if (!reason?.trim()) return;
  try {
    const result = await api("/api/v1/admin/ai-usage/costs/backfill?limit=5000", {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() })
    });
    toast(`Backfill: ${result.calculated} calculated · ${result.missingRate} missing rate.`, result.missingRate ? "info" : "success");
    await loadAiCosts();
  } catch (error) {
    toast(error.message, "error");
  }
});
$("#createAiCostButton").addEventListener("click", openCreateAiCost);
$("#aiCostProviderFilter").addEventListener("change", () => { state.aiCostProviderFilter = $("#aiCostProviderFilter").value.trim(); void loadAiCosts(); });
$("#aiCostModelFilter").addEventListener("change", () => { state.aiCostModelFilter = $("#aiCostModelFilter").value.trim(); void loadAiCosts(); });
$("#aiCostActiveFilter").addEventListener("change", () => { state.aiCostActiveFilter = $("#aiCostActiveFilter").value; void loadAiCosts(); });
$("#aiCostProviderFilter").addEventListener("keydown", (event) => { if (event.key === "Enter") { state.aiCostProviderFilter = $("#aiCostProviderFilter").value.trim(); void loadAiCosts(); } });
$("#aiCostModelFilter").addEventListener("keydown", (event) => { if (event.key === "Enter") { state.aiCostModelFilter = $("#aiCostModelFilter").value.trim(); void loadAiCosts(); } });
$("#marginDays").addEventListener("change", () => {
  state.marginDays = Number($("#marginDays").value || 7);
  sessionStorage.setItem("ait.admin.marginDays", String(state.marginDays));
  void loadMargin();
});
$("#backfillRevenueButton").addEventListener("click", async () => {
  if (state.admin?.role !== "SUPER_ADMIN") {
    toast("Chỉ SUPER_ADMIN được backfill revenue.", "error");
    return;
  }
  const reason = window.prompt("Lý do backfill revenue:", "Backfill revenue after FX configuration");
  if (!reason?.trim()) return;
  try {
    const result = await api("/api/v1/admin/revenue/backfill?limit=5000", {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() })
    });
    toast(`Revenue backfill: ${result.normalized} normalized · ${result.missingFx} missing FX.`, result.missingFx ? "info" : "success");
    await loadMargin();
  } catch (error) {
    toast(error.message, "error");
  }
});
$("#createFxRateButton").addEventListener("click", openCreateFxRate);
$("#fxBaseFilter").addEventListener("change", () => { state.fxBaseFilter = $("#fxBaseFilter").value.trim().toUpperCase(); void loadMargin(); });
$("#fxQuoteFilter").addEventListener("change", () => { state.fxQuoteFilter = $("#fxQuoteFilter").value.trim().toUpperCase(); void loadMargin(); });
$("#fxActiveFilter").addEventListener("change", () => { state.fxActiveFilter = $("#fxActiveFilter").value; void loadMargin(); });
$("#userSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") { state.usersPage = 0; void loadUsers(); } });
$("#statusFilter").addEventListener("change", () => { state.usersPage = 0; void loadUsers(); });
$("#prevUsers").addEventListener("click", () => { if (state.usersPage > 0) { state.usersPage -= 1; void loadUsers(); } });
$("#nextUsers").addEventListener("click", () => { if ((state.usersPage + 1) * state.usersSize < state.usersTotal) { state.usersPage += 1; void loadUsers(); } });
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });

if (state.token && state.admin) showApp(); else showLogin();
