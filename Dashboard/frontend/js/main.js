/** Điểm khởi động: xác thực, nạp dữ liệu, gắn sự kiện, điều phối các component và routing giữa các view. */

import { api } from "./api.js";
import { clearToken, isAuthenticated, setToken } from "./auth.js";
import { setFilter, setPageData, state } from "./state.js";
import { initFilters, populateTypes } from "./components/filters.js";
import { renderStats } from "./components/stats.js";
import { renderTable } from "./components/ticketTable.js";
import { renderPagination } from "./components/pagination.js";
import { renderDetail } from "./components/ticketDetail.js";
import { renderAuthView } from "./components/authView.js";
import { initNotifications } from "./components/notifications.js";
import { avatarColor, initials } from "./utils.js";

// Tham chiếu DOM
const els = {
  appShell: document.getElementById("app-shell"),
  viewAuth: document.getElementById("view-auth"),
  stats: document.getElementById("stats"),
  tbody: document.getElementById("ticket-tbody"),
  footerCount: document.getElementById("footer-count"),
  pager: document.getElementById("pagination"),
  tabCount: document.getElementById("tab-count"),
  helpFab: document.getElementById("help-fab"),
  viewList: document.getElementById("view-list"),
  viewDetail: document.getElementById("view-detail"),
  contextPill: document.getElementById("context-pill"),
  breadcrumbBack: document.getElementById("breadcrumb-back"),
  breadcrumbCurrent: document.getElementById("breadcrumb-current"),
  detailMain: document.getElementById("detail-main"),
  detailSide: document.getElementById("detail-side"),
  profileBtn: document.getElementById("profile-btn"),
  profileMenu: document.getElementById("profile-menu"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileName: document.getElementById("profile-name"),
  profileRole: document.getElementById("profile-role"),
  profileMenuEmail: document.getElementById("profile-menu-email"),
  btnLogout: document.getElementById("btn-logout"),
  notifBell: document.getElementById("btn-notify"),
  notifDot: document.getElementById("notif-dot"),
  notifPanel: document.getElementById("notif-panel"),
  notifList: document.getElementById("notif-list"),
};

/** Controller trả về từ initNotifications() — gán khi bootstrap(), dùng lại trong startApp(). */
let notifications = null;

/** Hiện thông báo dạng toast ngắn. */
function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// ============================= XÁC THỰC =============================

function showApp() {
  els.viewAuth.hidden = true;
  els.appShell.hidden = false;
}

function showAuthScreen() {
  els.appShell.hidden = true;
  els.viewAuth.hidden = false;
  els.profileMenu.hidden = true;
  renderAuthView(els.viewAuth, {
    onLogin: handleLogin,
    onRegister: handleRegister,
    onGoogleCredential: handleGoogleCredential,
    onFacebookToken: handleFacebookToken,
  });
}

function renderProfile(user) {
  els.profileAvatar.textContent = initials(user.name);
  els.profileAvatar.style.background = avatarColor(user.name);
  els.profileName.textContent = user.name;
  els.profileRole.textContent = user.role;
  els.profileMenuEmail.textContent = user.email;
}

async function afterAuthSuccess(token, user) {
  setToken(token);
  renderProfile(user);
  showApp();
  toast(`Xin chào, ${user.name}!`);
  await startApp();
}

async function handleLogin({ email, password }) {
  const { token, user } = await api.login({ email, password });
  await afterAuthSuccess(token, user);
}

async function handleRegister({ name, email, password }) {
  const { token, user } = await api.register({ name, email, password });
  await afterAuthSuccess(token, user);
}

async function handleGoogleCredential(idToken) {
  const { token, user } = await api.loginGoogle(idToken);
  await afterAuthSuccess(token, user);
}

async function handleFacebookToken(accessToken) {
  const { token, user } = await api.loginFacebook(accessToken);
  await afterAuthSuccess(token, user);
}

async function handleLogout() {
  try {
    await api.logout();
  } catch (_) {
    /* token có thể đã hết hạn sẵn — vẫn cứ đăng xuất phía client */
  }
  clearToken();
  location.hash = "";
  showAuthScreen();
}

async function tryResumeSession() {
  if (!isAuthenticated()) {
    showAuthScreen();
    return;
  }
  try {
    const user = await api.me();
    renderProfile(user);
    showApp();
    await startApp();
  } catch (_) {
    clearToken();
    showAuthScreen();
  }
}

// ============================= DANH SÁCH / CHI TIẾT TICKET =============================

/** Chuyển sang view danh sách. */
function showListView() {
  els.viewList.hidden = false;
  els.viewDetail.hidden = true;
  els.contextPill.hidden = true;
}

/** Chuyển sang view chi tiết. */
function showDetailView() {
  els.viewList.hidden = true;
  els.viewDetail.hidden = false;
  els.contextPill.hidden = false;
}

/** Nạp lại danh sách ticket theo bộ lọc + trang hiện tại. */
async function refreshList() {
  const { filters, page, pageSize } = state;
  try {
    const data = await api.listTickets({
      q: filters.q,
      type: filters.type,
      status: filters.status,
      sort: filters.sort,
      page,
      page_size: pageSize,
    });
    setPageData(data);
    renderTable(els.tbody, state.tickets, openTicket);
    renderPagination(els.footerCount, els.pager, {
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      onPageChange: (p) => {
        state.page = p;
        refreshList();
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
  } catch (err) {
    toast(err.message);
  }
}

/** Nạp lại thống kê (3 thẻ + badge tab). */
async function refreshStats() {
  try {
    const stats = await api.getStats();
    renderStats(els.stats, stats);
    els.tabCount.textContent = stats.total;
  } catch (err) {
    toast(err.message);
  }
}

/** Mở trang chi tiết full-screen cho 1 ticket. */
async function openTicket(id) {
  if (location.hash !== `#ticket=${id}`) {
    location.hash = `ticket=${id}`;
    return; // hashchange sẽ tự gọi lại openTicket(id)
  }
  try {
    const ticket = await api.getTicket(id);
    els.breadcrumbCurrent.textContent = `#${ticket.id}`;
    renderDetail(els.detailMain, els.detailSide, ticket, {
      ticketTypes: state.ticketTypes,
      onToggleStatus: handleToggleStatus,
      onChangeType: handleChangeType,
      onAddNote: handleAddNote,
      onReassign: handleReassign,
    });
    showDetailView();
    window.scrollTo({ top: 0 });
  } catch (err) {
    toast(err.message);
    location.hash = "";
  }
}

/** Deep-link: mở trang chi tiết theo hash (#ticket=<id>), hoặc về danh sách nếu hash rỗng. */
function openFromHash() {
  if (!isAuthenticated()) return;
  const m = /^#ticket=([\w-]+)/.exec(location.hash);
  if (m) {
    openTicket(m[1]);
  } else {
    showListView();
    refreshList();
    refreshStats();
  }
}

/** Đổi trạng thái ticket rồi làm mới trang chi tiết + danh sách + thống kê. */
async function handleToggleStatus(id, status) {
  try {
    await api.updateStatus(id, status);
    toast(status === "completed" ? "Đã đánh dấu hoàn thành" : "Đã chuyển về chưa hoàn thành");
    await Promise.all([openTicket(id), refreshStats()]);
  } catch (err) {
    toast(err.message);
  }
}

/** Đổi loại ticket rồi làm mới trang chi tiết. */
async function handleChangeType(id, ticketType) {
  try {
    await api.updateTicketType(id, ticketType);
    toast("Đã cập nhật loại ticket");
    await openTicket(id);
  } catch (err) {
    toast(err.message);
  }
}

/** Thêm trao đổi nội bộ rồi làm mới trang chi tiết. */
async function handleAddNote(id, content) {
  try {
    await api.addNote(id, content);
    await openTicket(id);
  } catch (err) {
    toast(err.message);
  }
}

/** Phân công người xử lý rồi làm mới trang chi tiết. */
async function handleReassign(id, assignee) {
  try {
    await api.updateAssignee(id, assignee);
    toast("Đã cập nhật người xử lý");
    await openTicket(id);
  } catch (err) {
    toast(err.message);
  }
}

/** Nạp danh sách loại ticket cho dropdown lọc + dropdown trong trang chi tiết. */
async function loadTypes() {
  try {
    const { ticket_types } = await api.getTicketTypes();
    state.ticketTypes = ticket_types;
    populateTypes(ticket_types);
  } catch (err) {
    toast(err.message);
  }
}

/** Chạy sau khi đăng nhập thành công (hoặc khôi phục phiên hợp lệ). */
async function startApp() {
  await loadTypes();
  refreshStats();
  openFromHash();
  // initNotifications() có thể đã chạy lần refresh() đầu tiên từ lúc chưa đăng nhập
  // (chưa có token nên fetch thất bại và bị bỏ qua) -> refresh lại ngay bây giờ khi
  // chắc chắn đã có token hợp lệ, thay vì đợi tới chu kỳ poll kế tiếp.
  notifications?.refresh();
}

// ============================= KHỞI ĐỘNG =============================

function bootstrap() {
  // Gắn sự kiện bộ lọc
  initFilters({
    onSearch: (q) => {
      setFilter("q", q);
      refreshList();
    },
    onType: (type) => {
      setFilter("type", type);
      refreshList();
    },
    onStatus: (status) => {
      setFilter("status", status);
      refreshList();
    },
    onSort: (sort) => {
      setFilter("sort", sort);
      refreshList();
    },
  });

  els.breadcrumbBack.addEventListener("click", () => {
    location.hash = "";
  });

  els.helpFab.addEventListener("click", () => {
    toast("Cần hỗ trợ? Liên hệ tổ CNTT — hotline nội bộ 1082.");
  });

  // Dropdown hồ sơ (đăng xuất)
  els.profileBtn.addEventListener("click", () => {
    els.profileMenu.hidden = !els.profileMenu.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!els.profileMenu.hidden && !els.profileBtn.contains(e.target) && !els.profileMenu.contains(e.target)) {
      els.profileMenu.hidden = true;
    }
  });
  els.btnLogout.addEventListener("click", handleLogout);

  // Chuông thông báo: chấm chỉ hiện khi có ticket mới kể từ lần xem cuối.
  notifications = initNotifications({
    api,
    bellBtn: els.notifBell,
    dotEl: els.notifDot,
    panelEl: els.notifPanel,
    listEl: els.notifList,
    onNavigate: (id) => {
      location.hash = `ticket=${id}`;
    },
  });

  // Deep-link: mở trang chi tiết theo hash khi tải trang và khi hash đổi.
  window.addEventListener("hashchange", openFromHash);

  // Token bị từ chối ở bất kỳ request nào (hết hạn/đăng xuất nơi khác) -> quay về màn đăng nhập.
  window.addEventListener("auth:unauthorized", () => {
    toast("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    showAuthScreen();
  });

  tryResumeSession();
}

document.addEventListener("DOMContentLoaded", bootstrap);
