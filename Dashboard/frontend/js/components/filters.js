/** Component: ô tìm kiếm + 3 dropdown lọc. Chỉ lo bắt sự kiện, báo ra ngoài. */

import { debounce, escapeHtml } from "../utils.js";

/**
 * @param {object} handlers - { onSearch(q), onType(type), onStatus(status), onSort(sort) }
 */
export function initFilters(handlers) {
  const searchInput = document.getElementById("search-input");
  const typeSelect = document.getElementById("filter-type");
  const statusSelect = document.getElementById("filter-status");
  const sortSelect = document.getElementById("filter-sort");

  searchInput.addEventListener(
    "input",
    debounce((e) => handlers.onSearch(e.target.value.trim()))
  );
  typeSelect.addEventListener("change", (e) => handlers.onType(e.target.value));
  statusSelect.addEventListener("change", (e) => handlers.onStatus(e.target.value));
  sortSelect.addEventListener("change", (e) => handlers.onSort(e.target.value));
}

/** Đổ danh sách loại ticket vào dropdown lọc. */
export function populateTypes(types = []) {
  const typeSelect = document.getElementById("filter-type");
  const current = typeSelect.value;
  const options = ['<option value="">Tất cả loại Ticket</option>']
    .concat(types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`))
    .join("");
  typeSelect.innerHTML = options;
  typeSelect.value = current;
}
