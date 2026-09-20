from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken


def create(
    session: Session,
    *,
    user_id: int,
    token_hash: str,
    expires_at: datetime,
) -> RefreshToken:
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked_at=None,
    )
    session.add(refresh_token)
    session.flush()
    return refresh_token


def get_by_hash_for_update(session: Session, token_hash: str) -> RefreshToken | None:
    statement = select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
    return session.scalar(statement)


def get_by_hash_for_user_for_update(
    session: Session,
    *,
    token_hash: str,
    user_id: int,
) -> RefreshToken | None:
    statement = (
        select(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        )
        .with_for_update()
    )
    return session.scalar(statement)


def revoke_all_active(session: Session, *, user_id: int, revoked_at: datetime) -> None:
    session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=revoked_at)
    )
