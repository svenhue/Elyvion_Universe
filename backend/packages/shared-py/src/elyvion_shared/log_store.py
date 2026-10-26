"""PostgreSQL-backed log storage shared by Python application services."""

import json
from datetime import timezone
from typing import Any, Literal
from uuid import uuid4

import asyncpg

LogLevel = Literal["debug", "info", "warn", "error"]


class LogStore:
    """Persists and queries the platform's shared log entries."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def initialize(self) -> None:
        async with self._pool.acquire() as connection:
            await connection.execute("CREATE SCHEMA IF NOT EXISTS logging")
            await connection.execute(
                """
                DO $$ BEGIN
                    CREATE TYPE logging."LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$
                """
            )
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS logging."LogEntry" (
                    id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    level logging."LogLevel" NOT NULL DEFAULT 'info',
                    message TEXT NOT NULL,
                    "actionKey" TEXT,
                    context JSONB,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            await connection.execute(
                'CREATE INDEX IF NOT EXISTS "LogEntry_source_idx" ON logging."LogEntry" (source)'
            )
            await connection.execute(
                """
                CREATE INDEX IF NOT EXISTS "LogEntry_actionKey_idx"
                ON logging."LogEntry" ("actionKey")
                """
            )
            await connection.execute(
                """
                CREATE INDEX IF NOT EXISTS "LogEntry_createdAt_idx"
                ON logging."LogEntry" ("createdAt")
                """
            )

    async def create(
        self,
        *,
        source: str,
        message: str,
        level: LogLevel = "info",
        action_key: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                INSERT INTO logging."LogEntry"
                    (id, source, level, message, "actionKey", context)
                VALUES ($1, $2, $3::text::logging."LogLevel", $4, $5, $6::jsonb)
                RETURNING id, source, level, message, "actionKey", context, "createdAt"
                """,
                str(uuid4()),
                source,
                level,
                message,
                action_key,
                json.dumps(context) if context is not None else None,
            )
        if row is None:
            raise RuntimeError("Log entry insert returned no row.")
        return self._to_dict(row)

    async def list(
        self,
        *,
        source: str | None = None,
        level: LogLevel | None = None,
        action_key: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        filters: list[str] = []
        values: list[Any] = []
        for column, value in (
            ("source", source),
            ('"level"', level),
            ('"actionKey"', action_key),
        ):
            if value is None:
                continue
            values.append(value)
            cast = "::text::logging.\"LogLevel\"" if column == '"level"' else ""
            filters.append(f"{column} = ${len(values)}{cast}")

        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        values.append(limit)
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                f"""
                SELECT id, source, level, message, "actionKey", context, "createdAt"
                FROM logging."LogEntry"
                {where}
                ORDER BY "createdAt" DESC
                LIMIT ${len(values)}
                """,
                *values,
            )
        return [self._to_dict(row) for row in rows]

    @staticmethod
    def _to_dict(row: asyncpg.Record) -> dict[str, Any]:
        result = dict(row)
        context = result["context"]
        if isinstance(context, str):
            result["context"] = json.loads(context)
        created_at = result["createdAt"]
        if created_at.tzinfo is None:
            result["createdAt"] = created_at.replace(tzinfo=timezone.utc)
        return result
