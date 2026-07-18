"""Endpoint phân loại câu hỏi chatbot theo bộ quy tắc gán nhãn."""

from fastapi import APIRouter, Depends

from ..dependencies import get_current_user
from ..models import ClassifyRequest, ClassifyResult
from ..services.ticket_service import classify_question

router = APIRouter(prefix="/api/classify", tags=["classify"], dependencies=[Depends(get_current_user)])


@router.post(
    "",
    response_model=ClassifyResult,
    summary="Phân loại câu hỏi -> loại ticket / ưu tiên / data form (và tạo ticket nếu cần)",
)
def classify_endpoint(payload: ClassifyRequest) -> ClassifyResult:
    return classify_question(
        question=payload.question,
        sender=payload.sender,
        create_ticket=payload.create_ticket,
    )
