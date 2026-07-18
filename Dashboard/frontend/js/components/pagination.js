/** Component: dòng "Hiển thị x / y" + các nút chuyển trang. */

/**
 * @param {HTMLElement} footerCountEl - phần tử hiển thị số lượng
 * @param {HTMLElement} pagerEl - container nút phân trang
 * @param {object} opts - { page, pageSize, total, onPageChange(page) }
 */
export function renderPagination(footerCountEl, pagerEl, { page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  footerCountEl.textContent =
    total === 0
      ? "Hiển thị 0 / 0 Ticket"
      : `Hiển thị ${start}–${end} / ${total} Ticket`;

  const btns = [];
  btns.push(
    `<button class="page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Trang trước">‹</button>`
  );
  for (let p = 1; p <= totalPages; p++) {
    btns.push(
      `<button class="page-btn ${p === page ? "page-btn--active" : ""}" data-page="${p}">${p}</button>`
    );
  }
  btns.push(
    `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Trang sau">›</button>`
  );

  pagerEl.innerHTML = btns.join("");
  pagerEl.querySelectorAll("button[data-page]").forEach((b) => {
    if (b.disabled) return;
    b.addEventListener("click", () => {
      const p = Number(b.dataset.page);
      if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
    });
  });
}
