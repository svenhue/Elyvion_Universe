import unittest
from unittest.mock import patch

import httpx

from elyvion_shared import traffic
from elyvion_shared.traffic import TrafficObservabilityMiddleware, normalize_path, record_httpx_failure


class TrafficObservabilityTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_path_removes_query_and_sensitive_path_values(self):
        self.assertEqual(normalize_path("/api/users/12345?token=private"), "/api/users/:id")
        self.assertEqual(normalize_path("/api/token/private-value"), "/api/token/[REDACTED]")
        self.assertEqual(normalize_path("/api/users/name%40example.test"), "/api/users/[REDACTED]")

    async def test_asgi_middleware_records_metadata_without_payload_or_headers(self):
        captured = []
        scope = {
            "type": "http",
            "method": "POST",
            "scheme": "https",
            "path": "/api/users/12345",
            "query_string": b"api_key=never-store-this",
            "headers": [
                (b"authorization", b"Bearer never-store-this"),
                (b"content-length", b"18"),
                (b"x-correlation-id", b"trace-123"),
            ],
        }

        async def app(_scope, _receive, send):
            await send({"type": "http.response.start", "status": 201, "headers": []})
            await send({"type": "http.response.body", "body": b"response-secret"})

        async def receive():
            return {"type": "http.request", "body": b"request-secret", "more_body": False}

        sent = []

        async def send(message):
            sent.append(message)

        with patch("elyvion_shared.traffic._schedule_event", side_effect=captured.append):
            await TrafficObservabilityMiddleware(app, "test-service")(scope, receive, send)

        self.assertEqual(len(sent), 2)
        self.assertEqual(len(captured), 1)
        event = captured[0]
        self.assertEqual(event["path"], "/api/users/:id")
        self.assertEqual(event["statusCode"], 201)
        self.assertEqual(event["responseBytes"], len(b"response-secret"))
        self.assertEqual(event["correlationId"], "trace-123")
        self.assertNotIn("never-store-this", repr(event))
        self.assertNotIn("request-secret", repr(event))
        self.assertNotIn("response-secret", repr(event))
        self.assertNotIn("authorization", repr(event))

    async def test_httpx_hook_emits_only_response_metadata(self):
        captured = []
        request = httpx.Request(
            "POST",
            "https://service.test/api/secret/private-value?token=never-store-this",
            headers={"authorization": "Bearer never-store-this", "x-correlation-id": "trace-456"},
            content=b"request-secret",
        )
        response = httpx.Response(
            503,
            request=request,
            headers={"content-length": "14"},
            content=b"response-secret",
        )
        hooks = traffic.create_traffic_httpx_hooks()
        traffic._module_name = "test-client"

        with patch("elyvion_shared.traffic._schedule_event", side_effect=captured.append):
            await hooks["request"][0](request)
            await hooks["response"][0](response)

        self.assertEqual(len(captured), 1)
        event = captured[0]
        self.assertEqual(event["path"], "/api/secret/[REDACTED]")
        self.assertEqual(event["statusCode"], 503)
        self.assertEqual(event["errorCode"], "HTTP_503")
        self.assertNotIn("never-store-this", repr(event))
        self.assertNotIn("request-secret", repr(event))
        self.assertNotIn("response-secret", repr(event))
        self.assertNotIn("authorization", repr(event))

    async def test_httpx_failure_records_only_generic_network_errors(self):
        captured = []
        request = httpx.Request(
            "GET",
            "https://service.test/api/users/12345?token=never-store-this",
            headers={"authorization": "Bearer never-store-this"},
        )

        with patch("elyvion_shared.traffic._schedule_event", side_effect=captured.append):
            record_httpx_failure(httpx.ConnectError("never-store-this", request=request))

        self.assertEqual(len(captured), 1)
        self.assertEqual(captured[0]["errorCode"], "HTTP_CLIENT_ERROR")
        self.assertEqual(captured[0]["errorDetail"], "HTTP request failed")
        self.assertEqual(captured[0]["path"], "/api/users/:id")
        self.assertNotIn("never-store-this", repr(captured[0]))


if __name__ == "__main__":
    unittest.main()
