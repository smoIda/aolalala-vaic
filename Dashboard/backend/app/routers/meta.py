"""Endpoint metadata phục vụ frontend (dropdown lọc, danh mục)."""

from fastapi import APIRouter, Depends

from ..config import PRIORITY_LABELS, STATUS_LABELS
from ..dependencies import get_current_user
from ..repositories import ticket_repo
from ..services.classifier import get_data_forms

router = APIRouter(prefix="/api/meta", tags=["meta"], dependencies=[Depends(get_current_user)])


@router.get("/ticket-types", summary="Danh sách loại ticket cho dropdown lọc")
def ticket_types() -> dict:
    return {"ticket_types": ticket_repo.ticket_types()}


@router.get("/enums", summary="Nhãn hiển thị cho trạng thái / ưu tiên / data form")
def enums() -> dict:
    return {
        "status_labels": STATUS_LABELS,
        "priority_labels": PRIORITY_LABELS,
        "data_forms": get_data_forms(),
    }
