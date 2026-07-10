from __future__ import annotations

import asyncio
import json

from fastapi import Request, Response

from applywise.middleware import RequestBoundaryMiddleware


def test_request_boundary_rejects_oversized_bodies_and_sets_security_headers() -> None:
    async def app(_scope, _receive, _send) -> None:
        return None

    async def call_next(_request: Request) -> Response:
        raise AssertionError("Oversized requests must not reach the route handler.")

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/body",
            "headers": [(b"content-length", b"5")],
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
            "scheme": "http",
        }
    )
    middleware = RequestBoundaryMiddleware(app, max_body_bytes=4)
    response = asyncio.run(middleware.dispatch(request, call_next))

    assert response.status_code == 413
    assert json.loads(response.body) == {"detail": "Request body is too large."}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert len(response.headers["x-request-id"]) == 32
