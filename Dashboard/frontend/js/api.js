/** Lớp gọi API duy nhất - mọi giao tiếp mạng đi qua đây. */

import { API_BASE_URL } from "./config.js";
import { clearToken, getToken } from "./auth.js";

async function request(path, { method = "GET", body, params, skipAuth = false } = {}) {
  let url = API_BASE_URL + path;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += "?" + s;
  }

  const token = skipAuth ? null : getToken();
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token đang dùng bị từ chối (hết hạn/đã đăng xuất ở nơi khác) -> buộc đăng nhập lại.
  // Không áp dụng khi request vốn không mang token (vd sai mật khẩu ở form đăng nhập).
  if (res.status === 401 && token) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (_) {
      /* bỏ qua */
    }
    throw new Error(`Lỗi ${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // ---- Xác thực ----
  /** Đăng ký tài khoản mới bằng email/mật khẩu. */
  register(payload) {
    return request("/api/auth/register", { method: "POST", body: payload, skipAuth: true });
  },
  /** Đăng nhập bằng email/mật khẩu. */
  login(payload) {
    return request("/api/auth/login", { method: "POST", body: payload, skipAuth: true });
  },
  /** Đăng nhập bằng ID token của Google. */
  loginGoogle(idToken) {
    return request("/api/auth/login/google", {
      method: "POST",
      body: { id_token: idToken },
      skipAuth: true,
    });
  },
  /** Đăng nhập bằng access token của Facebook. */
  loginFacebook(accessToken) {
    return request("/api/auth/login/facebook", {
      method: "POST",
      body: { access_token: accessToken },
      skipAuth: true,
    });
  },
  /** Thông tin tài khoản đang đăng nhập. */
  me() {
    return request("/api/auth/me");
  },
  /** Đăng xuất (hủy token hiện tại). */
  logout() {
    return request("/api/auth/logout", { method: "POST" });
  },

  // ---- Ticket ----
  /** Danh sách ticket (lọc/sắp xếp/phân trang). */
  listTickets(params) {
    return request("/api/tickets", { params });
  },
  /** Thống kê tổng/chưa/đã hoàn thành. */
  getStats() {
    return request("/api/tickets/stats");
  },
  /** Chi tiết 1 ticket. */
  getTicket(id) {
    return request(`/api/tickets/${encodeURIComponent(id)}`);
  },
  /** Đổi trạng thái ticket. */
  updateStatus(id, status) {
    return request(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
    });
  },
  /** Đổi loại ticket. */
  updateTicketType(id, ticket_type) {
    return request(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { ticket_type },
    });
  },
  /** Thêm trao đổi nội bộ. */
  addNote(id, content) {
    return request(`/api/tickets/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      body: { content },
    });
  },
  /** Phân công người xử lý. */
  updateAssignee(id, assignee) {
    return request(`/api/tickets/${encodeURIComponent(id)}/assignee`, {
      method: "PATCH",
      body: assignee,
    });
  },
  /** Danh sách loại ticket cho dropdown lọc. */
  getTicketTypes() {
    return request("/api/meta/ticket-types");
  },
  /** Phân loại một câu hỏi (tùy chọn tạo ticket). */
  classify(payload) {
    return request("/api/classify", { method: "POST", body: payload });
  },
};
