"""Fine management: list, pay, waive, create."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.enums import FineStatus
from app.models.user import User
from app.schemas.circulation import (
    FineOut,
    FinePaymentRequest,
    FineWaiveRequest,
    ManualFineRequest,
)
from app.schemas.common import Page
from app.services import circulation_service

router = APIRouter(tags=["fines"])


def _enrich(db: Session, fines: list) -> list[FineOut]:
    names = {}
    for f in fines:
        if f.user_id not in names:
            u = db.get(User, f.user_id)
            names[f.user_id] = u.full_name if u else None
    out = []
    for f in fines:
        fo = FineOut.model_validate(f)
        fo.member_name = names.get(f.user_id)
        out.append(fo)
    return out


@router.get("/me/fines", response_model=list[FineOut])
def my_fines(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[FineOut]:
    fines, _ = circulation_service.list_fines(db, user_id=user.id, page_size=100)
    return [FineOut.model_validate(f) for f in fines]


@router.get("/fines", response_model=Page[FineOut])
def list_fines(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
    member_id: uuid.UUID | None = None,
    status: FineStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Page[FineOut]:
    fines, total = circulation_service.list_fines(
        db, user_id=member_id, status=status, page=page, page_size=page_size
    )
    return Page[FineOut](
        items=_enrich(db, fines), total=total, page=page, page_size=page_size
    )


@router.post("/fines", response_model=FineOut, status_code=201)
def create_fine(
    data: ManualFineRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> FineOut:
    fine = circulation_service.create_manual_fine(
        db, user_id=data.member_id, fine_type=data.type, amount=data.amount,
        reason=data.reason, loan_id=data.loan_id, staff_id=staff.id,
    )
    db.commit()
    db.refresh(fine)
    return FineOut.model_validate(fine)


@router.post("/fines/{fine_id}/payment", response_model=FineOut)
def pay_fine(
    fine_id: uuid.UUID,
    data: FinePaymentRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> FineOut:
    fine = circulation_service.record_payment(
        db, fine_id=fine_id, amount=data.amount, method=data.method,
        note=data.note, staff_id=staff.id,
    )
    db.commit()
    db.refresh(fine)
    return FineOut.model_validate(fine)


@router.post("/fines/{fine_id}/waive", response_model=FineOut)
def waive_fine(
    fine_id: uuid.UUID,
    data: FineWaiveRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> FineOut:
    fine = circulation_service.waive_fine(
        db, fine_id=fine_id, reason=data.reason, staff_id=staff.id
    )
    db.commit()
    db.refresh(fine)
    return FineOut.model_validate(fine)
