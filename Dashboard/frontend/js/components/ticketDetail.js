/** Component: trang chi tiết ticket full-screen (thay cho modal). */

import { STATUS_LABELS } from "../config.js";
import { avatarColor, escapeHtml, formatDateTime, initials } from "../utils.js";

function statusBadge(status) {
  const cls = status === "completed" ? "completed" : "pending";
  return `<span class="status status--${cls}"><span class="status__dot"></span>${STATUS_LABELS[status] || status}</span>`;
}

function personRow(name, role) {
  return `
    <div class="person-row">
      <span class="sender__avatar" style="background:${avatarColor(name)}">${initials(name)}</span>
      <span class="person-row__meta">
        <span class="person-row__name">${escapeHtml(name)}</span>
        ${role ? `<span class="person-row__role">${escapeHtml(role)}</span>` : ""}
      </span>
    </div>`;
}

function infoRow(label, valueHtml) {
  return `
    <div class="info-row">
      <span class="info-row__label">${label}</span>
      <span class="info-row__value">${valueHtml}</span>
    </div>`;
}

function noteItem(note) {
  return `
    <div class="note-item">
      <div class="note-item__head">
        <span class="note-item__author">${escapeHtml(note.author)}</span>
        <span class="note-item__time">${formatDateTime(note.created_at)}</span>
      </div>
      <p class="note-item__content">${escapeHtml(note.content)}</p>
    </div>`;
}

function typeOptions(types, current) {
  const list = types.includes(current) ? types : [current, ...types];
  return list
    .map((t) => `<option value="${escapeHtml(t)}" ${t === current ? "selected" : ""}>${escapeHtml(t)}</option>`)
    .join("");
}

/**
 * @param {HTMLElement} mainEl - cột trái (#detail-main)
 * @param {HTMLElement} sideEl - cột phải (#detail-side)
 * @param {object} ticket
 * @param {object} handlers - { ticketTypes, onToggleStatus, onChangeType, onAddNote, onReassign }
 */
export function renderDetail(mainEl, sideEl, ticket, handlers) {
  const isDone = ticket.status === "completed";

  mainEl.innerHTML = `
    <div class="detail-card ticket-head-card">
      <div class="ticket-head-card__top">
        <span class="cell-id">#${escapeHtml(ticket.id)}</span>
        ${statusBadge(ticket.status)}
      </div>
      <h2 class="ticket-head-card__title">${escapeHtml(ticket.full_question || ticket.question)}</h2>
      <div class="ticket-head-card__meta">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <span>${formatDateTime(ticket.created_at)}</span>
      </div>
    </div>

    <div class="detail-card notes-card">
      <div class="side-card__title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>Trao đổi nội bộ</span>
      </div>
      <div class="notes-list" id="notes-list">
        ${
          ticket.notes && ticket.notes.length
            ? ticket.notes.map(noteItem).join("")
            : `<p class="notes-empty">Chưa có trao đổi nội bộ nào.</p>`
        }
      </div>
      <div class="note-compose">
        <textarea id="note-input" class="note-compose__input" rows="2" placeholder="Nhập nội dung trao đổi nội bộ..."></textarea>
        <button class="btn btn--primary" id="note-send" type="button">Gửi</button>
      </div>
    </div>
  `;

  sideEl.innerHTML = `
    <div class="detail-card side-card">
      <div class="side-card__title">HÀNH ĐỘNG NHANH</div>
      <button class="btn btn--primary btn--block" id="action-toggle-status" type="button">
        ${isDone ? "Đánh dấu Chưa hoàn thành" : "Đánh dấu Đã hoàn thành"}
      </button>
      <button class="btn btn--block" id="action-reassign-toggle" type="button">Phân công lại</button>

      <div class="reassign-form" id="reassign-form" hidden>
        <label class="reassign-form__label">Họ tên</label>
        <input class="reassign-form__input" id="reassign-name" type="text"
               value="${escapeHtml(ticket.assignee?.name || "")}" placeholder="Họ tên người xử lý" />
        <label class="reassign-form__label">Chức danh</label>
        <input class="reassign-form__input" id="reassign-role" type="text"
               value="${escapeHtml(ticket.assignee?.role || "")}" placeholder="VD: Bác sĩ Tim mạch" />
        <label class="reassign-form__label">Email</label>
        <input class="reassign-form__input" id="reassign-email" type="email"
               value="${escapeHtml(ticket.assignee?.email || "")}" placeholder="email@bvtimhanoi.vn" />
        <label class="reassign-form__label">Điện thoại</label>
        <input class="reassign-form__input" id="reassign-phone" type="text"
               value="${escapeHtml(ticket.assignee?.phone || "")}" placeholder="024 xxx xxxx" />
        <div class="reassign-form__actions">
          <button class="btn" id="reassign-cancel" type="button">Hủy</button>
          <button class="btn btn--primary" id="reassign-save" type="button">Lưu</button>
        </div>
      </div>
    </div>

    <div class="detail-card side-card">
      <div class="side-card__title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
        <span>THÔNG TIN NGƯỜI GỬI</span>
      </div>
      ${personRow(ticket.sender?.name || "Không rõ", null)}
      ${infoRow("Số điện thoại", escapeHtml(ticket.sender?.phone || "—"))}
      ${infoRow("Email", escapeHtml(ticket.sender?.email || "—"))}
    </div>

    <div class="detail-card side-card">
      <div class="side-card__title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
        </svg>
        <span>THÔNG TIN TICKET</span>
      </div>
      <div class="info-row">
        <span class="info-row__label">Loại Ticket</span>
        <select class="select select--sm" id="detail-type-select">
          ${typeOptions(handlers.ticketTypes || [], ticket.ticket_type)}
        </select>
      </div>
      ${infoRow("Thời gian tạo", formatDateTime(ticket.created_at))}
      ${infoRow("Trạng thái", statusBadge(ticket.status))}
    </div>

    <div class="detail-card side-card">
      <div class="side-card__title">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>THÔNG TIN NGƯỜI XỬ LÝ</span>
      </div>
      ${
        ticket.assignee
          ? `${personRow(ticket.assignee.name, ticket.assignee.role)}
             ${infoRow("Email", escapeHtml(ticket.assignee.email || "—"))}
             ${infoRow("Điện thoại", escapeHtml(ticket.assignee.phone || "—"))}`
          : `<p class="notes-empty">Chưa phân công người xử lý.</p>`
      }
    </div>
  `;

  wireEvents(mainEl, sideEl, ticket, isDone, handlers);
}

function wireEvents(mainEl, sideEl, ticket, isDone, handlers) {
  const noteBtn = mainEl.querySelector("#note-send");
  noteBtn.addEventListener("click", async () => {
    const input = mainEl.querySelector("#note-input");
    const content = input.value.trim();
    if (!content) return;
    noteBtn.disabled = true;
    try {
      await handlers.onAddNote(ticket.id, content);
    } finally {
      noteBtn.disabled = false;
    }
  });

  sideEl.querySelector("#action-toggle-status").addEventListener("click", () => {
    handlers.onToggleStatus(ticket.id, isDone ? "pending" : "completed");
  });

  sideEl.querySelector("#detail-type-select").addEventListener("change", (e) => {
    handlers.onChangeType(ticket.id, e.target.value);
  });

  const reassignForm = sideEl.querySelector("#reassign-form");
  sideEl.querySelector("#action-reassign-toggle").addEventListener("click", () => {
    reassignForm.hidden = !reassignForm.hidden;
  });
  sideEl.querySelector("#reassign-cancel").addEventListener("click", () => {
    reassignForm.hidden = true;
  });
  sideEl.querySelector("#reassign-save").addEventListener("click", () => {
    const nameInput = sideEl.querySelector("#reassign-name");
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    handlers.onReassign(ticket.id, {
      name,
      role: sideEl.querySelector("#reassign-role").value.trim() || null,
      email: sideEl.querySelector("#reassign-email").value.trim() || null,
      phone: sideEl.querySelector("#reassign-phone").value.trim() || null,
    });
  });
}
