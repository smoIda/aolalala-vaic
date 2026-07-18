/** Lưu trữ token đăng nhập (localStorage) — không chứa logic gọi API. */

import { AUTH_TOKEN_KEY } from "./config.js";

export function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
