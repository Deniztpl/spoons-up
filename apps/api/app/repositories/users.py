from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: int) -> User | None:
        return self.session.get(User, user_id)

    def list_seen_since(self, *, seen_since: datetime) -> list[User]:
        query = select(User).where(User.last_seen_at >= seen_since).order_by(User.id)
        return list(self.session.scalars(query))

    def create(
        self,
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
        self.session.add(user)
        self.session.flush()
        return user

    def set_last_seen_at(self, *, user: User, last_seen_at: datetime) -> None:
        user.last_seen_at = last_seen_at
        self.session.flush()

    def set_last_frozen_week(self, *, user: User, week_start: date) -> None:
        user.last_frozen_week = week_start
        self.session.flush()
