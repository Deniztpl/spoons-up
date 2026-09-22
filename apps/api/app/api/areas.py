from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import AreaServiceDependency
from app.schemas.areas import (
    ArchiveAreaRequest,
    AreaListResponse,
    AreaResponse,
    CreateAreaRequest,
    UpdateAreaRequest,
)
from app.schemas.errors import ErrorResponse, ValidationErrorResponse

router = APIRouter(prefix="/areas", tags=["areas"])

READ_RESPONSES = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}
WRITE_RESPONSES = READ_RESPONSES | {409: {"model": ErrorResponse}}
AreaIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]


@router.get(
    "",
    response_model=AreaListResponse,
    responses={401: {"model": ErrorResponse}, 422: {"model": ValidationErrorResponse}},
)
def list_areas(
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
    include_archived: bool = Query(default=False),
) -> AreaListResponse:
    return area_service.list(
        user_id=current_user.id,
        include_archived=include_archived,
    )


@router.post(
    "",
    response_model=AreaResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ValidationErrorResponse},
    },
)
def create_area(
    payload: CreateAreaRequest,
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
) -> AreaResponse:
    return area_service.create(payload, user_id=current_user.id)


@router.get("/{area_id}", response_model=AreaResponse, responses=READ_RESPONSES)
def get_area(
    area_id: AreaIdPath,
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
) -> AreaResponse:
    return area_service.get(area_id=int(area_id), user_id=current_user.id)


@router.patch("/{area_id}", response_model=AreaResponse, responses=WRITE_RESPONSES)
def rename_area(
    area_id: AreaIdPath,
    payload: UpdateAreaRequest,
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
) -> AreaResponse:
    return area_service.rename(payload, area_id=int(area_id), user_id=current_user.id)


@router.post("/{area_id}/archive", response_model=AreaResponse, responses=READ_RESPONSES)
def archive_area(
    area_id: AreaIdPath,
    payload: ArchiveAreaRequest,
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
) -> AreaResponse:
    return area_service.archive(payload, area_id=int(area_id), user_id=current_user.id)


@router.delete(
    "/{area_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def delete_area(
    area_id: AreaIdPath,
    current_user: CurrentUserDependency,
    area_service: AreaServiceDependency,
) -> None:
    area_service.delete(area_id=int(area_id), user_id=current_user.id)
