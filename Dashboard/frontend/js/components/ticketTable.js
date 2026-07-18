/** Component: bảng danh sách ticket. */

import { STATUS_LABELS } from "../config.js";
import { avatarColor, escapeHtml, formatDate, initials } from "../utils.js";

function statusCell(status) {
  const cls = status === "completed" ? "completed" : "pending";
  const label = STATUS_LABELS[status] || status;
  return `<span class="status status--${cls}"><span class="status__dot"></span>${label}</span>`;
}

function senderCell(sender) {
  const name = sender?.name || "Không rõ";
  const email = sender?.email || "";
  return `
    <div class="sender">
      <span class="sender__avatar" style="background:${avatarColor(name)}">${initials(name)}</span>
      <span class="sender__meta">
        <span class="sender__name">${escapeHtml(name)}</span>
        <span class="sender__email">${escapeHtml(email)}</span>
      </span>
    </div>`;
}

function row(t) {
  return `
    <tr data-id="${escapeHtml(t.id)}">
      <td class="cell-id">#${escapeHtml(t.id)}</td>
      <td class="cell-question" title="${escapeHtml(t.question)}">${escapeHtml(t.question)}</td>
      <td><span class="type-pill">${escapeHtml(t.ticket_type)}</span></td>
      <td>${statusCell(t.status)}</td>
      <td class="cell-date">${formatDate(t.created_at)}</td>
      <td>${senderCell(t.sender)}</td>
    </tr>`;
}

/**
 * @param {HTMLElement} tbody
 * @param {Array} tickets
 * @param {(id:string)=>void} onRowClick
 */
export function renderTable(tbody, tickets, onRowClick) {
  if (!tickets.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Không có ticket nào khớp bộ lọc.</td></tr>`;
    return;
  }
  tbody.innerHTML = tickets.map(row).join("");
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => onRowClick(tr.dataset.id));
  });
}
