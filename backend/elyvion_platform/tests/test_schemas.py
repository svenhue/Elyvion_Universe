import unittest
from datetime import datetime, timezone

from app.schemas import CreateLogRequest, LogEntryResponse


class PlatformSchemaTests(unittest.TestCase):
    def test_create_log_accepts_action_key_alias_and_defaults_level(self):
        payload = CreateLogRequest.model_validate(
            {"source": "actions-engine", "message": "ran", "actionKey": "send_email"}
        )

        self.assertEqual(payload.level, "info")
        self.assertEqual(payload.action_key, "send_email")

    def test_log_response_serializes_frontend_field_names(self):
        response = LogEntryResponse.model_validate(
            {
                "id": "entry-id",
                "source": "frontend",
                "level": "info",
                "message": "ran",
                "actionKey": "copy",
                "context": None,
                "createdAt": datetime(2026, 10, 26, tzinfo=timezone.utc),
            }
        )

        self.assertEqual(response.model_dump(by_alias=True)["actionKey"], "copy")
        self.assertIn("createdAt", response.model_dump(by_alias=True))


if __name__ == "__main__":
    unittest.main()
