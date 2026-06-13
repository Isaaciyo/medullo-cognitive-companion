from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from ..auth import create_device_token, get_current_user, get_optional_current_user
from ..database import get_db
from ..models import User
from ..schemas import DeviceTokenCreate, DeviceTokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/devices", response_model=DeviceTokenOut)
def create_device(
    payload: DeviceTokenCreate,
    db: DbSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> DeviceTokenOut:
    """Provision a device token.

    If the request already has a valid bearer token, the new device is attached
    to that user. Otherwise this creates a new anonymous user boundary.
    """
    user, device, raw_token = create_device_token(
        db,
        user=current_user,
        device_name=payload.device_name,
        install_id=payload.install_id,
    )
    db.commit()
    return DeviceTokenOut(
        user_id=user.id,
        device_id=device.id,
        access_token=raw_token,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
