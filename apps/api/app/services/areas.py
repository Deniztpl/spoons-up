from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AreaNameTakenError, NotFoundError
from app.models import Area
from app.repositories.areas import AreaRepository
from app.schemas.areas import (
    ArchiveAreaRequest,
    AreaListResponse,
    AreaResponse,
    CreateAreaRequest,
    UpdateAreaRequest,
)


class AreaService:
    def __init__(self, session: Session, area_repository: AreaRepository) -> None:
        self.session = session
        self.area_repository = area_repository

    def list(self, *, user_id: int, include_archived: bool) -> AreaListResponse:
        with self.session.begin():
            areas = self.area_repository.list_for_user(
                user_id=user_id,
                include_archived=include_archived,
            )
            response = AreaListResponse(areas=[_area_response(area) for area in areas])
        return response

    def get(self, *, area_id: int, user_id: int) -> AreaResponse:
        with self.session.begin():
            area = self._get_owned_area(area_id=area_id, user_id=user_id)
            response = _area_response(area)
        return response

    def create(self, payload: CreateAreaRequest, *, user_id: int) -> AreaResponse:
        try:
            with self.session.begin():
                area = self.area_repository.create(user_id=user_id, name=payload.name)
                response = _area_response(area)
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
                response = _area_response(area)
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
            archived_at = datetime.now(UTC) if payload.archived else None
            self.area_repository.set_archived(area=area, archived_at=archived_at)
            response = _area_response(area)
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


def _area_response(area: Area) -> AreaResponse:
    return AreaResponse(
        id=str(area.id),
        name=area.name,
        archived_at=area.archived_at,
        created_at=area.created_at,
    )
