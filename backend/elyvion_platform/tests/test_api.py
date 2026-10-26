import unittest
from datetime import datetime, timezone

import httpx
from app.main import app
from elyvion_shared import StoredFile, StoredFileMeta


class FakeLogStore:
    async def create(self, **kwargs):
        return {
            "id": "log-id",
            "source": kwargs["source"],
            "level": kwargs["level"],
            "message": kwargs["message"],
            "actionKey": kwargs["action_key"],
            "context": kwargs["context"],
            "createdAt": datetime.now(timezone.utc),
        }

    async def list(self, **kwargs):
        self.filters = kwargs
        return [
            {
                "id": "log-id",
                "source": "frontend",
                "level": "info",
                "message": "saved",
                "actionKey": "copy",
                "context": None,
                "createdAt": datetime.now(timezone.utc),
            }
        ]


class FakeFileStore:
    async def upload(self, content, filename, mime_type):
        self.content = content
        return StoredFileMeta("file-id", filename, mime_type, len(content))

    async def download(self, file_id):
        async def stream():
            yield b"content"

        return StoredFile(
            "file-id", "report.txt", "text/plain", 7, stream()
        )

    async def remove(self, file_id):
        self.removed_id = file_id


class PlatformApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        app.state.log_store = FakeLogStore()
        app.state.file_store = FakeFileStore()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_logs_keep_the_existing_envelope_and_camel_case_fields(self):
        created = await self.client.post(
            "/logs",
            json={
                "source": "actions-engine",
                "message": "Action executed",
                "actionKey": "send_email",
            },
        )
        self.assertEqual(created.status_code, 200)
        self.assertEqual(created.json()["data"]["actionKey"], "send_email")

        listed = await self.client.get("/logs?source=frontend&actionKey=copy")
        self.assertEqual(listed.json()["data"][0]["message"], "saved")
        self.assertEqual(app.state.log_store.filters["action_key"], "copy")

    async def test_files_keep_upload_envelope_streaming_and_delete_contract(self):
        uploaded = await self.client.post(
            "/files",
            files={"file": ("report.txt", b"content", "text/plain")},
        )
        self.assertEqual(
            uploaded.json()["data"],
            {
                "id": "file-id",
                "filename": "report.txt",
                "mimeType": "text/plain",
                "size": 7,
            },
        )

        downloaded = await self.client.get("/files/file-id")
        self.assertEqual(downloaded.content, b"content")
        self.assertEqual(downloaded.headers["content-type"], "text/plain")

        removed = await self.client.delete("/files/file-id")
        self.assertEqual(removed.json(), {"data": {"removed": True}})
        self.assertEqual(app.state.file_store.removed_id, "file-id")


if __name__ == "__main__":
    unittest.main()
