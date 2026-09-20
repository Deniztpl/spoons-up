from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config.auth import auth_settings
from app.core.errors import EmailTakenError, InvalidCredentialsError, InvalidTokenError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_password_for_missing_user,
)
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest


@dataclass(frozen=True, slots=True)
class TokenPair:
    access_token: str
    refresh_token: str


class AuthService:
    def __init__(
        self,
        session: Session,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
    ) -> None:
        self.session = session
        self.user_repository = user_repository
        self.refresh_token_repository = refresh_token_repository

    def register(self, payload: RegisterRequest) -> TokenPair:
        normalized_email = _normalize_email(str(payload.email))
        password_hash = hash_password(payload.password)

        try:
            with self.session.begin():
                if self.user_repository.get_by_email(normalized_email) is not None:
                    raise EmailTakenError

                user = self.user_repository.create(
                    email=normalized_email,
                    password_hash=password_hash,
                    timezone=payload.timezone,
                )
                tokens = self._issue_token_pair(user.id)
        except IntegrityError as exc:
            raise EmailTakenError from exc

        return tokens

    def login(self, payload: LoginRequest) -> TokenPair:
        with self.session.begin():
            user = self.user_repository.get_by_email(_normalize_email(str(payload.email)))
            if user is None:
                verify_password_for_missing_user(payload.password)
                raise InvalidCredentialsError
            if not verify_password(payload.password, user.password_hash):
                raise InvalidCredentialsError

            tokens = self._issue_token_pair(user.id)
        return tokens

    def refresh(self, token: str | None) -> TokenPair:
        if token is None:
            raise InvalidTokenError

        now = datetime.now(UTC)
        stored_token = self.refresh_token_repository.get_by_hash_for_update(
            hash_refresh_token(token),
        )
        if stored_token is None:
            raise InvalidTokenError

        if stored_token.revoked_at is not None:
            self.refresh_token_repository.revoke_all_active(
                user_id=stored_token.user_id,
                revoked_at=now,
            )
            # committed before raising: the revocation must survive the error
            self.session.commit()
            raise InvalidTokenError

        if stored_token.expires_at <= now:
            stored_token.revoked_at = now
            # committed before raising: the revocation must survive the error
            self.session.commit()
            raise InvalidTokenError

        stored_token.revoked_at = now
        tokens = self._issue_token_pair(stored_token.user_id, now=now)
        self.session.commit()
        return tokens

    def logout(self, *, user_id: int, token: str | None) -> None:
        if token is None:
            return

        stored_token = self.refresh_token_repository.get_by_hash_for_user_for_update(
            token_hash=hash_refresh_token(token),
            user_id=user_id,
        )
        if stored_token is not None and stored_token.revoked_at is None:
            stored_token.revoked_at = datetime.now(UTC)
            self.session.commit()
            return

    def _issue_token_pair(self, user_id: int, *, now: datetime | None = None) -> TokenPair:
        issued_at = now or datetime.now(UTC)
        raw_refresh_token = generate_refresh_token()
        self.refresh_token_repository.create(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=issued_at + timedelta(days=auth_settings.refresh_token_days),
        )
        access_token = create_access_token(
            user_id,
            auth_settings.jwt_secret.get_secret_value(),
            auth_settings.access_token_minutes,
            now=issued_at,
        )
        return TokenPair(access_token=access_token, refresh_token=raw_refresh_token)


def _normalize_email(email: str) -> str:
    return email.strip().lower()
