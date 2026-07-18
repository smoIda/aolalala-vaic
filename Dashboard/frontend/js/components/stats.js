/** Component: 3 thẻ thống kê (Tổng / Chưa hoàn thành / Đã hoàn thành). */

const ICONS = {
  total: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  done: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`,
};

function card(modifier, icon, value, label) {
  return `
    <div class="stat-card stat-card--${modifier}">
      <div class="stat-card__icon">${icon}</div>
      <div>
        <div class="stat-card__value">${value}</div>
        <div class="stat-card__label">${label}</div>
      </div>
    </div>`;
}

export function renderStats(container, stats) {
  const s = stats || { total: 0, pending: 0, completed: 0 };
  container.innerHTML = [
    card("total", ICONS.total, s.total, "Tổng Ticket"),
    card("pending", ICONS.pending, s.pending, "Chưa hoàn thành"),
    card("done", ICONS.done, s.completed, "Đã hoàn thành"),
  ].join("");
}
