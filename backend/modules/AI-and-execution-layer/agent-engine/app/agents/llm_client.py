import os
from pathlib import Path

import httpx

from elyvion_shared import create_http_client, record_httpx_failure


async def chat_completion(
    llm_url: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    tool_choice: dict | str | None = None,
) -> dict:
    payload: dict = {"messages": messages}
    if tools:
        payload["tools"] = tools
    if tool_choice:
        payload["tool_choice"] = tool_choice

    token_file = os.environ.get("LOCAL_LLM_SERVICE_TOKEN_FILE")
    if not token_file:
        raise RuntimeError("LOCAL_LLM_SERVICE_TOKEN_FILE is not configured.")
    try:
        token = Path(token_file).read_text(encoding="utf-8").strip()
    except OSError as error:
        raise RuntimeError("Local LLM service credentials are unavailable.") from error
    if not token:
        raise RuntimeError("Local LLM service credentials are empty.")

    endpoint = f"{llm_url.rstrip('/')}/v1/chat/completions"
    async with create_http_client(timeout=300.0) as client:
        try:
            response = await client.post(endpoint, json=payload, headers={"Authorization": f"Bearer {token}"})
        except httpx.HTTPError as error:
            record_httpx_failure(error)
            raise
        response.raise_for_status()
        result = response.json()
    if not isinstance(result, dict) or not isinstance(result.get("choices"), list) or not result["choices"]:
        raise RuntimeError("local-llm returned an invalid chat completion.")
    return result["choices"][0]["message"]
