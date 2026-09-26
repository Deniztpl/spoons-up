from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps.auth import CurrentUserDependency
from app.api.deps.services import GoalServiceDependency
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.schemas.goals import (
    CreateGoalRequest,
    CreateGoalRuleRequest,
    GoalListResponse,
    GoalResponse,
    GoalRuleResponse,
    UpdateGoalRequest,
    UpdateGoalRuleRequest,
)

goals_router = APIRouter(prefix="/goals", tags=["goals"])
rules_router = APIRouter(prefix="/rules", tags=["goal rules"])

READ_RESPONSES = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    422: {"model": ValidationErrorResponse},
}
GoalIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]
RuleIdPath = Annotated[str, Path(pattern=r"^[0-9]+$")]
AreaIdQuery = Annotated[str | None, Query(pattern=r"^[0-9]+$")]


@goals_router.get(
    "",
    response_model=GoalListResponse,
    responses={401: {"model": ErrorResponse}, 422: {"model": ValidationErrorResponse}},
)
def list_goals(
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
    area_id: AreaIdQuery = None,
) -> GoalListResponse:
    return goal_service.list(
        user_id=current_user.id,
        area_id=int(area_id) if area_id is not None else None,
    )


@goals_router.post(
    "",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
    responses=READ_RESPONSES,
)
def create_goal(
    payload: CreateGoalRequest,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> GoalResponse:
    return goal_service.create(payload, user_id=current_user.id)


@goals_router.get("/{goal_id}", response_model=GoalResponse, responses=READ_RESPONSES)
def get_goal(
    goal_id: GoalIdPath,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> GoalResponse:
    return goal_service.get(goal_id=int(goal_id), user_id=current_user.id)


@goals_router.patch("/{goal_id}", response_model=GoalResponse, responses=READ_RESPONSES)
def update_goal(
    goal_id: GoalIdPath,
    payload: UpdateGoalRequest,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> GoalResponse:
    return goal_service.update(payload, goal_id=int(goal_id), user_id=current_user.id)


@goals_router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def delete_goal(
    goal_id: GoalIdPath,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> None:
    goal_service.delete(goal_id=int(goal_id), user_id=current_user.id)


@goals_router.post(
    "/{goal_id}/rules",
    response_model=GoalRuleResponse,
    status_code=status.HTTP_201_CREATED,
    responses=READ_RESPONSES,
)
def create_goal_rule(
    goal_id: GoalIdPath,
    payload: CreateGoalRuleRequest,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> GoalRuleResponse:
    return goal_service.create_rule(payload, goal_id=int(goal_id), user_id=current_user.id)


@rules_router.patch("/{rule_id}", response_model=GoalRuleResponse, responses=READ_RESPONSES)
def update_goal_rule(
    rule_id: RuleIdPath,
    payload: UpdateGoalRuleRequest,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> GoalRuleResponse:
    return goal_service.update_rule(payload, rule_id=int(rule_id), user_id=current_user.id)


@rules_router.delete(
    "/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=READ_RESPONSES,
)
def delete_goal_rule(
    rule_id: RuleIdPath,
    current_user: CurrentUserDependency,
    goal_service: GoalServiceDependency,
) -> None:
    goal_service.delete_rule(rule_id=int(rule_id), user_id=current_user.id)
