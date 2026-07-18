"""Nghiệp vụ xác thực: băm mật khẩu và xác minh token Google/Facebook.

Xác minh OAuth được thực hiện bằng cách gọi thẳng tới endpoint chính thức của
Google/Facebook (không tự chế cơ chế xác thực) — nếu Client ID/App ID chưa được
cấu hình ở frontend, các lệnh gọi này sẽ tự nhiên thất bại vì token không hợp lệ,
không có gì bị giả lập.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import HTTPException

from ..config import AUTH_HTTP_TIMEOUT, FACEBOOK_GRAPH_ME_URL, GOOGLE_TOKENINFO_URL

_HASH_ITERATIONS = 200_000
_HASH_ALGO = "sha256"


def hash_password(password: str) -> str:
    """Băm mật khẩu bằng PBKDF2-HMAC-SHA256 với salt ngẫu nhiên (chỉ dùng thư viện chuẩn)."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode("utf-8"), salt, _HASH_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """So khớp mật khẩu người dùng nhập với hash đã lưu."""
    try:
        salt_hex, digest_hex = stored_hash.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode("utf-8"), salt, _HASH_ITERATIONS)
    return hmac.compare_digest(expected, actual)


def _http_get_json(url: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(f"{url}?{query}", timeout=AUTH_HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=401, detail=f"Token không hợp lệ: {body}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=502, detail=f"Không thể xác minh token (lỗi mạng): {exc.reason}"
        ) from exc


def verify_google_id_token(id_token: str, expected_client_id: Optional[str] = None) -> dict:
    """Xác minh ID token của Google bằng endpoint tokeninfo chính thức.

    Trả về payload gồm email, name, picture nếu hợp lệ; ném HTTPException 401 nếu không.
    """
    data = _http_get_json(GOOGLE_TOKENINFO_URL, {"id_token": id_token})
    if expected_client_id and data.get("aud") != expected_client_id:
        raise HTTPException(status_code=401, detail="Token Google không khớp Client ID của ứng dụng")
    if not data.get("email"):
        raise HTTPException(status_code=401, detail="Token Google không chứa email")
    return {
        "email": data["email"],
        "name": data.get("name") or data["email"].split("@")[0],
        "provider_id": data.get("sub", ""),
    }


def verify_facebook_access_token(access_token: str) -> dict:
    """Xác minh access token của Facebook bằng cách gọi Graph API /me.

    Trả về payload gồm email, name nếu hợp lệ; ném HTTPException 401 nếu không.
    """
    data = _http_get_json(
        FACEBOOK_GRAPH_ME_URL, {"fields": "id,name,email", "access_token": access_token}
    )
    if "error" in data:
        raise HTTPException(status_code=401, detail=f"Token Facebook không hợp lệ: {data['error']}")
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Tài khoản Facebook không cung cấp email — vui lòng dùng phương thức đăng nhập khác",
        )
    return {"email": email, "name": data.get("name") or email.split("@")[0], "provider_id": data.get("id", "")}
