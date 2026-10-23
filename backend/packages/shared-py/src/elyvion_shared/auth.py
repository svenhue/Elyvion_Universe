"""JWT validation against the Auth module's JWKS endpoint (OIDC discovery:
{issuer}/jwks), mirroring the TypeScript JwtAuthGuard so both stacks enforce
the same standard."""

import time

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

_bearer_scheme = HTTPBearer(auto_error=False)

_jwks_cache: dict[str, tuple[float, dict]] = {}
_JWKS_TTL_SECONDS = 300


def _get_jwks(issuer_url: str) -> dict:
    cached = _jwks_cache.get(issuer_url)
    now = time.time()
    if cached and now - cached[0] < _JWKS_TTL_SECONDS:
        return cached[1]

    response = httpx.get(f"{issuer_url}/jwks", timeout=5.0)
    response.raise_for_status()
    jwks = response.json()
    _jwks_cache[issuer_url] = (now, jwks)
    return jwks


def make_current_user_dependency(issuer_url: str):
    """Factory so each module binds its own AUTH_ISSUER_URL, e.g.:
    CurrentUser = make_current_user_dependency(settings.auth_issuer_url)
    """

    def current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    ) -> dict:
        if credentials is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

        try:
            jwks = _get_jwks(issuer_url)
            payload = jwt.decode(
                credentials.credentials,
                jwks,
                issuer=issuer_url,
                options={"verify_aud": False},
            )
            return payload
        except JWTError as exc:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Invalid or expired token"
            ) from exc

    return current_user
