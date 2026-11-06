import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.llm_client import chat_completion
from app.agents.planner import design_team


class LlmClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.token_file = Path(self.temp_dir.name) / "service-token"
        self.token_file.write_text("test-token", encoding="utf-8")
        self.previous_token_file = os.environ.get("LOCAL_LLM_SERVICE_TOKEN_FILE")
        os.environ["LOCAL_LLM_SERVICE_TOKEN_FILE"] = str(self.token_file)

    def tearDown(self):
        self.temp_dir.cleanup()
        if self.previous_token_file is None:
            os.environ.pop("LOCAL_LLM_SERVICE_TOKEN_FILE", None)
        else:
            os.environ["LOCAL_LLM_SERVICE_TOKEN_FILE"] = self.previous_token_file

    async def test_chat_completion_sends_openai_messages_and_tools(self):
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": "answer"}}]}
        response.raise_for_status = lambda: None
        client = AsyncMock()
        client.post.return_value = response
        client_context = AsyncMock()
        client_context.__aenter__.return_value = client

        with patch("elyvion_shared.http_client.httpx.AsyncClient", return_value=client_context):
            message = await chat_completion(
                "http://local-llm:3028/",
                [{"role": "user", "content": "hi"}],
                tools=[{"type": "function"}],
            )

        self.assertEqual(message, {"content": "answer"})
        client.post.assert_awaited_once_with(
            "http://local-llm:3028/v1/chat/completions",
            headers={"Authorization": "Bearer test-token"},
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "tools": [{"type": "function"}],
            },
        )

    async def test_planner_decodes_function_call_arguments(self):
        tool_message = {
            "tool_calls": [{
                "function": {
                    "name": "design_team",
                    "arguments": (
                        '{"reasoning":"task fit","agents":['
                        '{"name":"Planner","system_prompt":"Plan it","focus":"Plan"},'
                        '{"name":"Reviewer","system_prompt":"Review it","focus":"Review"}]}'
                    ),
                },
            }],
        }

        with patch("app.agents.planner.chat_completion", new_callable=AsyncMock) as completion:
            completion.return_value = tool_message
            result = await design_team("http://local-llm:3028", "prepare a plan")

        self.assertEqual([agent.name for agent in result.agents], ["Planner", "Reviewer"])


if __name__ == "__main__":
    unittest.main()
