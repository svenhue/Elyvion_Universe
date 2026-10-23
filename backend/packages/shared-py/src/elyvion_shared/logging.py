import logging
import sys

import structlog


def configure_logging(module_name: str, environment: str = "development") -> None:
    """Structured JSON logging with a `module` field, mirroring the
    TypeScript side's pino setup so logs correlate across the platform."""

    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=logging.INFO)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if environment == "production"
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[*shared_processors, renderer],
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

    structlog.contextvars.bind_contextvars(module=module_name)


def get_logger(name: str | None = None):
    return structlog.get_logger(name)
