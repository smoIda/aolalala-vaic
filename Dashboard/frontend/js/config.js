/**
 * Cấu hình frontend.
 *
 * API_BASE_URL rỗng = gọi cùng origin (khi backend phục vụ luôn frontend tại /).
 * Nếu chạy frontend riêng (vd python -m http.server), đổi thành
 * "http://127.0.0.1:8000".
 */
export const API_BASE_URL = "";

export const PAGE_SIZE = 10;

/** Khóa lưu token đăng nhập trong localStorage. */
export const AUTH_TOKEN_KEY = "bvtimhn_auth_token";

/** Khóa lưu tập ID ticket admin đã từng xem trong panel thông báo (dùng để tính "thông báo mới"). */
export const NOTIF_SEEN_IDS_KEY = "bvtimhn_notif_seen_ids";

/**
 * Client ID / App ID cho đăng nhập mạng xã hội.
 * ĐIỀN GIÁ TRỊ THẬT VÀO ĐÂY để bật đăng nhập Google/Facebook — xem hướng dẫn lấy
 * Client ID/App ID trong README. Để trống thì nút tương ứng sẽ hiển thị ở trạng
 * thái "chưa cấu hình" thay vì giả vờ hoạt động.
 */
export const GOOGLE_CLIENT_ID = "";
export const FACEBOOK_APP_ID = "";

/** Nhãn hiển thị tiếng Việt cho trạng thái. */
export const STATUS_LABELS = {
  pending: "Chưa hoàn thành",
  completed: "Đã hoàn thành",
};

/** Nhãn hiển thị cho mức ưu tiên. */
export const PRIORITY_LABELS = {
  cao: "Cao",
  thuong: "Thường",
  khan: "Khẩn",
};

/** Bảng màu cho avatar người gửi (chọn theo tên). */
export const AVATAR_COLORS = [
  "#0d9488", "#2563eb", "#7c3aed", "#db2777",
  "#ea580c", "#16a34a", "#0891b2", "#d97706",
];
