const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  backendUrl: sessionStorage.getItem("ait.admin.backend") || "http://localhost:8080",
  token: sessionStorage.getItem("ait.admin.token") || "",
  admin: JSON.parse(sessionStorage.getItem("ait.admin.user") || "null"),
  currentView: "dashboard",
  usersPage: 0,
  usersSize: 25,
  usersTotal: 0,
  plans: [],
  planSchema: null,
  selectedUserId: null,
  selectedPlanCode: null
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
    hour: "2-digit", minute: "2-digit"
  }).format(date);
};

const fmtNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));

function toast(message, kind = "info") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast visible ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = "toast"; }, 3300);
}

function setSession(login) {
  state.token = login.accessToken;
  state.admin = login.user;
  sessionStorage.setItem("ait.admin.token", state.token);
  sessionStorage.setItem("ait.admin.user", JSON.stringify(state.admin));
  sessionStorage.setItem("ait.admin.backend", state.backendUrl);
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
  const labels = { dashboard: "Tổng quan", users: "Người dùng", plans: "Plans & Features", audit: "Audit log" };
  $("#pageTitle").textContent = labels[view] || "Admin";
  try {
    if (view === "dashboard") await loadDashboard();
    if (view === "users") await loadUsers();
    if (view === "plans") await loadPlans();
    if (view === "audit") await loadAudit();
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
      <div class="roadmap-grid"><span class="done">✓ Users & access</span><span class="working">→ 14.6 Plans & features</span><span>14.7 Pricing</span><span>14.8 AI costs</span><span>14.9 Security & operations</span></div>
    </article>`;
  $("[data-open-audit]")?.addEventListener("click", () => void loadView("audit"));
}

function metric(label, value, hint) {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${fmtNumber(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
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

async function ensurePlanSchema() {
  if (!state.planSchema) state.planSchema = await api("/api/v1/admin/plan-schema");
  return state.planSchema;
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
  $("#drawerBody").innerHTML = `
    <section class="drawer-section plan-section first">
      <div class="section-heading"><div><span class="eyebrow">PLAN DEFINITION</span><h3>Thông tin plan</h3></div></div>
      <div class="form-grid">
        <label><span>Code</span><input id="planCodeField" maxlength="30" value="${escapeHtml(plan.code)}" ${isCreate ? "" : "readonly"} placeholder="ULTIMATE" /></label>
        <label><span>Tên hiển thị</span><input id="planDisplayName" maxlength="80" value="${escapeHtml(plan.displayName)}" placeholder="Ultimate" /></label>
        <label><span>Rank</span><input id="planRank" type="number" min="0" max="100000" value="${Number(plan.rankOrder || 0)}" /></label>
        <label class="toggle-field"><span>Trạng thái</span><span class="toggle-line"><input id="planActive" type="checkbox" ${plan.active ? "checked" : ""} ${plan.code === "FREE" && !isCreate ? "disabled" : ""} /> Active</span></label>
      </div>
      <label><span>Mô tả</span><textarea id="planDescription" rows="2" maxlength="500" placeholder="Mô tả nội bộ cho plan...">${escapeHtml(plan.description || "")}</textarea></label>
    </section>
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
    const detail = await api(`/api/v1/admin/users/${userId}`);
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
      </div>
    </section>
    <section class="drawer-section">
      <div class="section-heading"><div><span class="eyebrow">PLAN OVERRIDE</span><h3>Quyền gói tạm thời</h3></div></div>
      <div class="form-grid"><label><span>Plan</span><select id="planSelect">${plans}</select></label><label><span>Hết hạn (tùy chọn)</span><input id="planExpiry" type="datetime-local" /></label></div>
      <div class="action-row"><button id="savePlan" class="primary">Áp dụng override</button><button id="clearPlan" class="ghost">Trả về license/subscription</button></div>
      <small class="muted">Override không sửa hoặc xóa license gốc. Xóa override sẽ quay lại quyền thực tế.</small>
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

async function loadAudit() {
  const rows = await api("/api/v1/admin/audit?limit=150");
  $("#auditTable").innerHTML = `<div class="card-heading"><div><span class="eyebrow">AUDIT TRAIL</span><h3>Thao tác quản trị</h3></div><span class="muted">${rows.length} bản ghi gần nhất</span></div>${auditRows(rows)}`;
}

function closeDrawer() {
  $("#drawerBackdrop").classList.add("hidden");
  $("#userDrawer").classList.add("hidden");
  state.selectedUserId = null;
  state.selectedPlanCode = null;
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#loginButton");
  button.disabled = true; button.textContent = "Đang xác thực...";
  $("#loginError").classList.add("hidden");
  try {
    state.backendUrl = $("#backendUrl").value.trim().replace(/\/$/, "");
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

$$(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => void loadView(button.dataset.view)));
$("#refreshButton").addEventListener("click", () => void loadView(state.currentView));
$("#logoutButton").addEventListener("click", () => { clearSession(); showLogin(); });
$("#searchUsersButton").addEventListener("click", () => { state.usersPage = 0; void loadUsers(); });
$("#createPlanButton").addEventListener("click", () => void openCreatePlan());
$("#userSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") { state.usersPage = 0; void loadUsers(); } });
$("#statusFilter").addEventListener("change", () => { state.usersPage = 0; void loadUsers(); });
$("#prevUsers").addEventListener("click", () => { if (state.usersPage > 0) { state.usersPage -= 1; void loadUsers(); } });
$("#nextUsers").addEventListener("click", () => { if ((state.usersPage + 1) * state.usersSize < state.usersTotal) { state.usersPage += 1; void loadUsers(); } });
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });

if (state.token && state.admin) showApp(); else showLogin();
