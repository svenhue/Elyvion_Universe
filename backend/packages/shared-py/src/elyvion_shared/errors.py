from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


def install_exception_handlers(app: FastAPI) -> None:
    """Normalizes every error response into the same JSON shape the
    TypeScript modules use, via ElyvionExceptionFilter."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return _error_response(request, exc.status_code, exc.detail)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        return _error_response(request, 500, "Internal server error")


def _error_response(request: Request, status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "statusCode": status_code,
                "message": message,
                "path": request.url.path,
                "correlationId": request.headers.get("x-correlation-id"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
