from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import PeriodResult


class PeriodResultRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(
        self,
        *,
        user_id: int,
        from_period_start: date,
        to_period_start: date,
    ) -> list[PeriodResult]:
        query = (
            select(PeriodResult)
            .where(
                PeriodResult.user_id == user_id,
                PeriodResult.period_start >= from_period_start,
                PeriodResult.period_start <= to_period_start,
            )
            .order_by(PeriodResult.period_start.desc(), PeriodResult.ref_type, PeriodResult.id)
        )
        return list(self.session.scalars(query))

    def add_results(self, *, values: list[dict[str, object]]) -> None:
        if not values:
            return

        query = insert(PeriodResult).values(values).on_conflict_do_nothing()
        self.session.execute(query)
