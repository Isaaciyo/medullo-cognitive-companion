from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DbSession

from .database import get_db
from .models import DeviceToken, User

bearer_scheme = HTTPBearer(auto_error=False)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_access_token() -> str:
    return f"medullo_{secrets.token_urlsafe(32)}"


def create_device_token(
    db: DbSession,
    *,
    user: User | None = None,
    device_name: str | None = None,
    install_id: str | None = None,
) -> tuple[User, DeviceToken, str]:
    if user is None:
        user = User(id=str(uuid.uuid4()))
        db.add(user)
        db.flush()

    raw_token = new_access_token()
    device = DeviceToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=hash_token(raw_token),
        device_name=device_name,
        install_id=install_id,
        created_at=datetime.utcnow(),
        last_seen_at=datetime.utcnow(),
    )
    db.add(device)
    db.flush()
    return user, device, raw_token


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DbSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hash_token(credentials.credentials)
    device = (
        db.query(DeviceToken)
        .filter(DeviceToken.token_hash == token_hash)
        .filter(DeviceToken.revoked_at.is_(None))
        .first()
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, device.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token user no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    device.last_seen_at = datetime.utcnow()
    db.flush()
    return user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DbSession = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def token_matches(raw_a: str, raw_b: str) -> bool:
    return hmac.compare_digest(raw_a, raw_b)
