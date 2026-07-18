/** Component: modal chi tiết ticket + đổi trạng thái. */

import { PRIORITY_LABELS, STATUS_LABELS } from "../config.js";
import { avatarColor, escapeHtml, formatDate, initials } from "../utils.js";

const overlay = document.getElementById("modal-overlay");
const bodyEl = document.getElementById("modal-body");

let currentToggleHandler = null;

function statusBadge(status) {
  const cls = status === "completed" ? "completed" : "pending";
  return `<span class="status status--${cls}"><span class="status__dot"></span>${STATUS_LABELS[status] || status}</span>`;
}

function priorityBadge(priority) {
  if (!priority) return '<span class="detail-item__value">—</span>';
  const label = PRIORITY_LABELS[priority] || priority;
  return `<span class="priority priority--${priority}">${label}</span>`;
}

function dataForm(t) {
  if (!t.data_form_code) return "—";
  return `${escapeHtml(t.data_form_code)} · ${escapeHtml(t.data_form_name || "")}`;
}

function item(label, valueHtml, full = false, normal = false) {
  const valueClass = normal ? "detail-item__value detail-item__value--normal" : "detail-item__value";
  return `
    <div class="detail-item ${full ? "detail-item--full" : ""}">
      <div class="detail-item__label">${label}</div>
      <div class="${valueClass}">${valueHtml}</div>
    </div>`;
}

export function openModal(ticket, { onToggleStatus }) {
  const isDone = ticket.status === "completed";
  const senderName = ticket.sender?.name || "Không rõ";

  bodyEl.innerHTML = `
    <div class="modal-head">
      <div>
        <div class="modal-head__id">#${escapeHtml(ticket.id)}</div>
        <div class="modal-head__title">Chi tiết Ticket</div>
      </div>
      <button class="modal-close" id="modal-close" aria-label="Đóng">×</button>
    </div>

    <div class="detail-grid">
      ${item("Trạng thái", statusBadge(ticket.status))}
      ${item("Mức ưu tiên", priorityBadge(ticket.priority))}
      ${item("Loại Ticket", `<span class="type-pill">${escapeHtml(ticket.ticket_type)}</span>`)}
      ${item("Data Form", escapeHtml(dataForm(ticket)))}
      ${item("Ngày tạo", formatDate(ticket.created_at))}
      ${item(
        "Người gửi",
        `<div class="sender">
           <span class="sender__avatar" style="background:${avatarColor(senderName)}">${initials(senderName)}</span>
           <span class="sender__meta">
             <span class="sender__name">${escapeHtml(senderName)}</span>
             <span class="sender__email">${escapeHtml(ticket.sender?.email || "")}</span>
           </span>
         </div>`
      )}
      ${item("Nội dung câu hỏi", escapeHtml(ticket.full_question || ticket.question), true, true)}
      ${
        ticket.suggested_action
          ? item("Hành động chatbot (theo quy tắc)", escapeHtml(ticket.suggested_action), true, true)
          : ""
      }
    </div>

    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Đóng</button>
      <button class="btn btn--primary" id="modal-toggle">
        ${isDone ? "Đánh dấu Chưa hoàn thành" : "Đánh dấu Đã hoàn thành"}
      </button>
    </div>`;

  overlay.hidden = false;

  bodyEl.querySelector("#modal-close").addEventListener("click", closeModal);
  bodyEl.querySelector("#modal-cancel").addEventListener("click", closeModal);

  const toggleBtn = bodyEl.querySelector("#modal-toggle");
  currentToggleHandler = async () => {
    toggleBtn.disabled = true;
    const newStatus = isDone ? "pending" : "completed";
    try {
      await onToggleStatus(ticket.id, newStatus);
      closeModal();
    } catch (err) {
      toggleBtn.disabled = false;
      throw err;
    }
  };
  toggleBtn.addEventListener("click", currentToggleHandler);
}

export function closeModal() {
  overlay.hidden = true;
  bodyEl.innerHTML = "";
  currentToggleHandler = null;
  // Dọn hash deep-link để URL sạch.
  if (location.hash.startsWith("#ticket=")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/** Đóng modal khi bấm ra nền tối hoặc nhấn Esc. */
export function initModalDismiss() {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });
}
