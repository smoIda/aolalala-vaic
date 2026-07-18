"""Engine phân loại câu hỏi chatbot theo bộ quy tắc gán nhãn (PDF).

Cách hoạt động:
- Nạp bộ quy tắc từ ``classification_rules.json``.
- Chuẩn hóa câu hỏi và keyword (bỏ dấu, thường hóa) để so khớp linh hoạt.
- Duyệt các rule theo THỨ TỰ trong file: quy tắc khẩn cấp đứng đầu, rồi tới
  các nhóm cụ thể; nếu không rule nào khớp thì rơi vào ``fallback`` (nhóm "Khác").
- Trả về một ``dict`` mô tả kết quả phân loại (nhóm, loại ticket, ưu tiên,
  data form, có cần tạo ticket, có phải khẩn cấp, hành động chatbot, keyword khớp).

Module này thuần logic, không phụ thuộc FastAPI để dễ test độc lập.
"""

from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from typing import Any, Dict, Optional

from ..config import CLASSIFICATION_RULES_FILE


def strip_accents(text: str) -> str:
    """Bỏ dấu tiếng Việt và hạ về chữ thường để so khớp không phụ thuộc dấu.

    Ví dụ: "Đau Ngực Dữ Dội" -> "dau nguc du doi".
    """
    text = text.lower().replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", text)
    without_marks = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return unicodedata.normalize("NFC", without_marks)


@lru_cache(maxsize=1)
def _load_rules() -> Dict[str, Any]:
    """Đọc và cache bộ quy tắc; đồng thời tiền xử lý keyword (bỏ dấu sẵn)."""
    with open(CLASSIFICATION_RULES_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)

    for rule in raw.get("rules", []):
        rule["_norm_keywords"] = [
            (kw, strip_accents(kw)) for kw in rule.get("keywords", [])
        ]
    return raw


def get_data_forms() -> Dict[str, str]:
    """Trả về ánh xạ mã Data Form -> tên (DF-H01..DF-H08)."""
    return dict(_load_rules().get("data_forms", {}))


def _build_result(rule: Dict[str, Any], matched_keyword: Optional[str]) -> Dict[str, Any]:
    """Chuẩn hóa một rule thành cấu trúc kết quả phân loại."""
    data_forms = _load_rules().get("data_forms", {})
    df_code = rule.get("data_form")
    return {
        "group": rule["group"],
        "ticket_type": rule["ticket_type"],
        "need_ticket": bool(rule.get("need_ticket", False)),
        "is_emergency": bool(rule.get("is_emergency", False)),
        "priority": rule.get("priority"),
        "data_form_code": df_code,
        "data_form_name": data_forms.get(df_code) if df_code else None,
        "chatbot_action": rule.get("chatbot_action", ""),
        "matched_keyword": matched_keyword,
    }


def classify(question: str) -> Dict[str, Any]:
    """Phân loại một câu hỏi thành kết quả gán nhãn ticket.

    Luôn trả về một kết quả (fallback "Khác" nếu không khớp keyword nào).
    """
    rules_data = _load_rules()
    normalized = strip_accents(question or "")

    for rule in rules_data.get("rules", []):
        for original_kw, norm_kw in rule["_norm_keywords"]:
            if norm_kw and norm_kw in normalized:
                return _build_result(rule, original_kw)

    # Không khớp rule nào -> fallback nhóm "Khác"
    return _build_result(rules_data["fallback"], None)
