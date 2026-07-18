/** Component: chuông thông báo — chấm vàng chỉ hiện khi có ticket mới chưa từng xem.
 *
 * Theo dõi bằng TẬP ID ticket đã xem (không dùng so sánh mốc thời gian) vì
 * created_at ở backend chỉ có độ chính xác tới phút, dễ so sánh sai khi 2 sự
 * kiện xảy ra trong cùng một phút.
 */

import { NOTIF_SEEN_IDS_KEY } from "../config.js";
import { escapeHtml, formatDateTime } from "../utils.js";

const POLL_INTERVAL_MS = 45_000;

function loadSeenIds() {
  const raw = localStorage.getItem(NOTIF_SEEN_IDS_KEY);
  return raw ? new Set(JSON.parse(raw)) : null; // null = chưa từng khởi tạo (lần đầu mở app)
}

function saveSeenIds(idsSet) {
  localStorage.setItem(NOTIF_SEEN_IDS_KEY, JSON.stringify([...idsSet]));
}

function renderList(listEl, tickets, seenIds, onNavigate) {
  if (!tickets.length) {
    listEl.innerHTML = `<p class="notif-empty">Chưa có ticket nào.</p>`;
    return;
  }
  listEl.innerHTML = tickets
    .map((t) => {
      const isUnread = !seenIds.has(t.id);
      return `
        <button class="notif-item" data-id="${escapeHtml(t.id)}" style="${isUnread ? "font-weight:600" : ""}">
          <div class="notif-item__id">#${escapeHtml(t.id)}</div>
          <div class="notif-item__question">${escapeHtml(t.question)}</div>
          <div class="notif-item__time">${formatDateTime(t.created_at)}</div>
        </button>`;
    })
    .join("");
  listEl.querySelectorAll(".notif-item").forEach((btn) => {
    btn.addEventListener("click", () => onNavigate(btn.dataset.id));
  });
}

/**
 * Khởi động chuông thông báo: theo dõi ticket mới nhất, bật/tắt chấm, xử lý mở/đóng panel.
 * @param {object} opts - { api, bellBtn, dotEl, panelEl, listEl, onNavigate(id) }
 * @returns {{ refresh: () => Promise<void> }}
 */
export function initNotifications({ api, bellBtn, dotEl, panelEl, listEl, onNavigate }) {
  let latestTickets = [];

  async function refresh() {
    try {
      const { items } = await api.listTickets({ sort: "newest", page: 1, page_size: 5 });
      latestTickets = items;

      let seen = loadSeenIds();
      if (seen === null) {
        // Lần đầu tiên mở app: coi các ticket hiện có là đã biết, không báo động hồi tố.
        seen = new Set(items.map((t) => t.id));
        saveSeenIds(seen);
      }

      const hasUnread = items.some((t) => !seen.has(t.id));
      dotEl.hidden = !hasUnread;
      if (!panelEl.hidden) {
        renderList(listEl, latestTickets, seen, onNavigate);
      }
    } catch (_) {
      /* im lặng bỏ qua lỗi polling nền, không làm phiền người dùng bằng toast lặp lại */
    }
  }

  bellBtn.addEventListener("click", () => {
    const opening = panelEl.hidden;
    panelEl.hidden = !panelEl.hidden;
    if (opening) {
      const seenBefore = loadSeenIds() || new Set();
      renderList(listEl, latestTickets, seenBefore, (id) => {
        panelEl.hidden = true;
        onNavigate(id);
      });
      // Đánh dấu toàn bộ mục đang hiển thị là đã xem.
      const updated = new Set([...seenBefore, ...latestTickets.map((t) => t.id)]);
      saveSeenIds(updated);
      dotEl.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    if (!panelEl.hidden && !panelEl.contains(e.target) && !bellBtn.contains(e.target)) {
      panelEl.hidden = true;
    }
  });

  refresh();
  setInterval(refresh, POLL_INTERVAL_MS);

  return { refresh };
}
