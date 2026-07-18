/** Trạng thái ứng dụng dùng chung (single source of truth phía client). */

import { PAGE_SIZE } from "./config.js";

export const state = {
  filters: {
    q: "",
    type: "",
    status: "",
    sort: "newest",
  },
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  tickets: [],
  /** map id -> ticket cho trang hiện tại, để mở nhanh trang chi tiết. */
  byId: {},
  /** danh sách loại ticket hiện có, dùng cho dropdown lọc + dropdown trong trang chi tiết. */
  ticketTypes: [],
};

/** Cập nhật một filter và luôn reset về trang 1. */
export function setFilter(key, value) {
  state.filters[key] = value;
  state.page = 1;
}

/** Lưu kết quả 1 trang danh sách vào state. */
export function setPageData({ items, total }) {
  state.tickets = items;
  state.total = total;
  state.byId = Object.fromEntries(items.map((t) => [t.id, t]));
}
