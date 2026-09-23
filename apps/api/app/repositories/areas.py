from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Area


class AreaRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(self, *, user_id: int, include_archived: bool) -> list[Area]:
        statement = select(Area).where(Area.user_id == user_id)
        if not include_archived:
            statement = statement.where(Area.archived_at.is_(None))
        return list(self.session.scalars(statement.order_by(Area.created_at, Area.id)))

    def get_for_user(self, *, area_id: int, user_id: int) -> Area | None:
        return self.session.scalar(select(Area).where(Area.id == area_id, Area.user_id == user_id))

    def create(self, *, user_id: int, name: str) -> Area:
        area = Area(
            user_id=user_id,
            name=name,
            archived_at=None,
            unarchived_at=None,
        )
        self.session.add(area)
        self.session.flush()
        return area

    def rename(self, *, area: Area, name: str) -> Area:
        area.name = name
        self.session.flush()
        return area

    def set_archive_timestamps(
        self,
        *,
        area: Area,
        archived_at: datetime | None,
        unarchived_at: datetime | None,
    ) -> Area:
        area.archived_at = archived_at
        area.unarchived_at = unarchived_at
        self.session.flush()
        return area

    def delete(self, *, area: Area) -> None:
        self.session.delete(area)
