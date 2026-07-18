/** Component: trang đăng nhập / đăng ký + đăng nhập Google/Facebook. */

import { FACEBOOK_APP_ID, GOOGLE_CLIENT_ID } from "../config.js";

const GOOGLE_ICON = `
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>`;

const FACEBOOK_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.891h-2.33v6.987C18.343 21.128 22 16.991 22 12z"/>
  </svg>`;

/** Đợi tối đa `timeout`ms cho tới khi `getter()` trả về giá trị truthy (dùng chờ SDK ngoài tải xong). */
function waitForGlobal(getter, timeout = 8000, interval = 150) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const value = getter();
      if (value) return resolve(value);
      if (Date.now() - start > timeout) return reject(new Error("timeout"));
      setTimeout(tick, interval);
    };
    tick();
  });
}

function formTemplate() {
  return `
    <div class="auth-card">
      <div class="auth-card__brand">
        <h1>Bệnh viện Tim Mạch Hà Nội</h1>
        <p>Hệ thống quản trị Ticket chatbot</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab auth-tab--active" type="button" data-mode="login">Đăng nhập</button>
        <button class="auth-tab" type="button" data-mode="register">Đăng ký</button>
      </div>

      <div id="auth-error" class="auth-error" hidden></div>

      <form class="auth-form" id="form-login">
        <div class="auth-field">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" required autocomplete="username" placeholder="ban@bvtimhanoi.vn" />
        </div>
        <div class="auth-field">
          <label for="login-password">Mật khẩu</label>
          <input id="login-password" type="password" required autocomplete="current-password" placeholder="••••••••" />
        </div>
        <button class="btn btn--primary btn--block" type="submit" id="login-submit">Đăng nhập</button>
        <p class="auth-hint">Tài khoản demo: admin@bvtimhanoi.vn / Admin@123</p>
      </form>

      <form class="auth-form" id="form-register" hidden>
        <div class="auth-field">
          <label for="register-name">Họ tên</label>
          <input id="register-name" type="text" required autocomplete="name" placeholder="Nguyễn Văn A" />
        </div>
        <div class="auth-field">
          <label for="register-email">Email</label>
          <input id="register-email" type="email" required autocomplete="username" placeholder="ban@bvtimhanoi.vn" />
        </div>
        <div class="auth-field">
          <label for="register-password">Mật khẩu</label>
          <input id="register-password" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" />
        </div>
        <div class="auth-field">
          <label for="register-confirm">Nhập lại mật khẩu</label>
          <input id="register-confirm" type="password" required minlength="6" autocomplete="new-password" placeholder="Nhập lại mật khẩu" />
        </div>
        <button class="btn btn--primary btn--block" type="submit" id="register-submit">Đăng ký</button>
      </form>

      <div class="auth-divider"><span>Hoặc đăng nhập bằng</span></div>

      <div class="auth-social">
        <div class="auth-google-container" id="google-btn-container"></div>
        <button class="auth-social-btn auth-social-btn--facebook" id="fb-login-btn" type="button">
          ${FACEBOOK_ICON}
          <span>Đăng nhập bằng Facebook</span>
        </button>
        ${
          !GOOGLE_CLIENT_ID || !FACEBOOK_APP_ID
            ? `<p class="auth-social-note">Đăng nhập ${
                !GOOGLE_CLIENT_ID && !FACEBOOK_APP_ID ? "Google/Facebook" : !GOOGLE_CLIENT_ID ? "Google" : "Facebook"
              } chưa được cấu hình Client ID/App ID (xem README).</p>`
            : ""
        }
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} container - #view-auth
 * @param {object} handlers - { onLogin, onRegister, onGoogleCredential, onFacebookToken }
 */
export function renderAuthView(container, handlers) {
  container.innerHTML = formTemplate();

  const errorEl = container.querySelector("#auth-error");
  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };
  const clearError = () => {
    errorEl.hidden = true;
    errorEl.textContent = "";
  };

  // ---- Chuyển tab đăng nhập / đăng ký ----
  const tabs = container.querySelectorAll(".auth-tab");
  const formLogin = container.querySelector("#form-login");
  const formRegister = container.querySelector("#form-register");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      clearError();
      tabs.forEach((t) => t.classList.toggle("auth-tab--active", t === tab));
      const isLogin = tab.dataset.mode === "login";
      formLogin.hidden = !isLogin;
      formRegister.hidden = isLogin;
    });
  });

  // ---- Submit đăng nhập ----
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const email = container.querySelector("#login-email").value.trim();
    const password = container.querySelector("#login-password").value;
    const btn = container.querySelector("#login-submit");
    btn.disabled = true;
    try {
      await handlers.onLogin({ email, password });
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Submit đăng ký ----
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const name = container.querySelector("#register-name").value.trim();
    const email = container.querySelector("#register-email").value.trim();
    const password = container.querySelector("#register-password").value;
    const confirm = container.querySelector("#register-confirm").value;
    if (password !== confirm) {
      showError("Mật khẩu nhập lại không khớp");
      return;
    }
    const btn = container.querySelector("#register-submit");
    btn.disabled = true;
    try {
      await handlers.onRegister({ name, email, password });
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  setupGoogleButton(container, handlers, showError);
  setupFacebookButton(container, handlers, showError);
}

function setupGoogleButton(container, handlers, showError) {
  const mount = container.querySelector("#google-btn-container");
  if (!GOOGLE_CLIENT_ID) {
    mount.innerHTML = `
      <button class="auth-social-btn" disabled type="button">
        ${GOOGLE_ICON}<span>Đăng nhập bằng Google</span>
      </button>`;
    return;
  }

  waitForGlobal(() => window.google?.accounts?.id)
    .then((googleId) => {
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await handlers.onGoogleCredential(response.credential);
          } catch (err) {
            showError(err.message);
          }
        },
      });
      googleId.renderButton(mount, { theme: "outline", size: "large", width: 372, text: "signin_with" });
    })
    .catch(() => {
      mount.innerHTML = `
        <button class="auth-social-btn" disabled type="button">
          ${GOOGLE_ICON}<span>Không tải được Google Sign-In</span>
        </button>`;
    });
}

function setupFacebookButton(container, handlers, showError) {
  const btn = container.querySelector("#fb-login-btn");
  if (!FACEBOOK_APP_ID) {
    btn.disabled = true;
    btn.querySelector("span").textContent = "Đăng nhập bằng Facebook";
    return;
  }

  let fbReady = null;
  const ensureInit = () =>
    (fbReady ??= waitForGlobal(() => window.FB).then((FB) => {
      FB.init({ appId: FACEBOOK_APP_ID, cookie: false, xfbml: false, version: "v19.0" });
      return FB;
    }));

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const FB = await ensureInit();
      FB.login(
        async (response) => {
          try {
            if (response.authResponse) {
              await handlers.onFacebookToken(response.authResponse.accessToken);
            } else {
              showError("Bạn đã hủy đăng nhập Facebook");
            }
          } catch (err) {
            showError(err.message);
          } finally {
            btn.disabled = false;
          }
        },
        { scope: "public_profile,email" }
      );
    } catch (_) {
      showError("Không tải được Facebook SDK — kiểm tra kết nối mạng");
      btn.disabled = false;
    }
  });
}
