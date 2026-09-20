from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def get_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email))


def create(
    session: Session,
    *,
    email: str,
    password_hash: str,
    timezone: str,
) -> User:
    user = User(
        email=email,
        password_hash=password_hash,
        timezone=timezone,
        week_start_day=1,
    )
    session.add(user)
    session.flush()
    return user
