from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AreaNameTakenError, NotFoundError
from app.models import Area, User
from app.repositories.areas import AreaRepository
from app.repositories.users import UserRepository
from app.schemas.areas import (
    ArchiveAreaRequest,
    AreaListResponse,
    AreaResponse,
    CreateAreaRequest,
    UpdateAreaRequest,
)
from app.services.tasks import TaskService


class AreaService:
    def __init__(
        self,
        session: Session,
        area_repository: AreaRepository,
        user_repository: UserRepository,
        task_service: TaskService,
    ) -> None:
        self.session = session
        self.area_repository = area_repository
        self.user_repository = user_repository
        self.task_service = task_service

    def list(self, *, user_id: int, include_archived: bool) -> AreaListResponse:
        with self.session.begin():
            areas = self.area_repository.list_for_user(
                user_id=user_id,
                include_archived=include_archived,
            )
            response = AreaListResponse(
                areas=[AreaResponse.model_validate(area) for area in areas],
            )
        return response

    def get(self, *, area_id: int, user_id: int) -> AreaResponse:
        with self.session.begin():
            area = self._get_owned_area(area_id=area_id, user_id=user_id)
            response = AreaResponse.model_validate(area)
        return response

    def create(self, payload: CreateAreaRequest, *, user_id: int) -> AreaResponse:
        try:
            with self.session.begin():
                area = self.area_repository.create(user_id=user_id, name=payload.name)
                response = AreaResponse.model_validate(area)
        except IntegrityError as exc:
            raise AreaNameTakenError from exc
        return response

    def rename(
        self,
        payload: UpdateAreaRequest,
        *,
        area_id: int,
        user_id: int,
    ) -> AreaResponse:
        try:
            with self.session.begin():
                area = self._get_owned_area(area_id=area_id, user_id=user_id)
                self.area_repository.rename(area=area, name=payload.name)
                response = AreaResponse.model_validate(area)
        except IntegrityError as exc:
            raise AreaNameTakenError from exc
        return response

    def archive(
        self,
        payload: ArchiveAreaRequest,
        *,
        area_id: int,
        user_id: int,
    ) -> AreaResponse:
        with self.session.begin():
            area = self._get_owned_area(area_id=area_id, user_id=user_id)

            if payload.archived and area.archived_at is None:
                archived_at = datetime.now(UTC)
                user = self._get_user(user_id=user_id)
                self.task_service.delete_pending_tasks_for_area(
                    area_id=area.id,
                    user_id=user_id,
                    from_date=archived_at.astimezone(ZoneInfo(user.timezone)).date(),
                )
                self.area_repository.set_archive_timestamps(
                    area=area,
                    archived_at=archived_at,
                    unarchived_at=area.unarchived_at,
                )
            elif not payload.archived and area.archived_at is not None:
                self.area_repository.set_archive_timestamps(
                    area=area,
                    archived_at=None,
                    unarchived_at=datetime.now(UTC),
                )

            response = AreaResponse.model_validate(area)
        return response

    def delete(self, *, area_id: int, user_id: int) -> None:
        with self.session.begin():
            area = self._get_owned_area(area_id=area_id, user_id=user_id)
            self.area_repository.delete(area=area)

    def _get_owned_area(self, *, area_id: int, user_id: int) -> Area:
        area = self.area_repository.get_for_user(area_id=area_id, user_id=user_id)
        if area is None:
            raise NotFoundError
        return area

    def _get_user(self, *, user_id: int) -> User:
        user = self.user_repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError
        return user
