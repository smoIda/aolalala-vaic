/** Các hàm tiện ích thuần (không chạm DOM ngoài ý muốn). */

import { AVATAR_COLORS } from "./config.js";

/** Trì hoãn gọi hàm cho tới khi ngừng gõ `delay` ms (dùng cho ô tìm kiếm). */
export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Lấy chữ cái đầu của họ (từ đầu tiên) để hiển thị trong avatar. */
export function initials(name = "") {
  const first = name.trim().split(/\s+/)[0] || "";
  return (first[0] || "?").toUpperCase();
}

/** Đổi ngày ISO (YYYY-MM-DD...) sang DD/MM/YYYY. */
export function formatDate(iso = "") {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Đổi datetime ISO (YYYY-MM-DDTHH:MM) sang "HH:MM DD/MM/YYYY". */
export function formatDateTime(iso = "") {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return formatDate(iso);
  const [, y, mo, d, h, mi] = m;
  return `${h}:${mi} ${d}/${mo}/${y}`;
}

/** Chọn màu avatar ổn định theo chuỗi tên. */
export function avatarColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Escape để chèn text người dùng vào HTML an toàn. */
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
