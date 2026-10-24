"""The only way an agent reaches an action — connects to actions-engine's
`/mcp` endpoint as an MCP *client*, so an agent sees exactly the same tool
catalog a human sees in the floating assistant's Actions tab, and calling
one goes through the same registry and the same zod validation on the
other side. No separate "agent tool" integration to keep in sync.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


@asynccontextmanager
async def mcp_session(url: str) -> AsyncIterator[ClientSession]:
    async with streamable_http_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def list_tools_as_anthropic_schema(session: ClientSession) -> list[dict]:
    result = await session.list_tools()
    return [
        {
            "name": tool.name,
            "description": tool.description or "",
            "input_schema": tool.input_schema,
        }
        for tool in result.tools
    ]


async def call_tool(session: ClientSession, name: str, arguments: dict) -> str:
    result = await session.call_tool(name, arguments)
    parts = [block.text for block in result.content if block.type == "text"]
    return "\n".join(parts) if parts else ""
