from __future__ import annotations

import json
import os
import time
from collections.abc import Sequence
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

DEFAULT_CLOUDFLARE_LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"
DEFAULT_CLOUDFLARE_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m"


class CloudflareAIError(RuntimeError):
    pass


class CloudflareAIConfigurationError(CloudflareAIError):
    pass


class CloudflareWorkersAIClient:
    def __init__(
        self,
        *,
        account_id: str,
        api_token: str,
        llm_model: str = DEFAULT_CLOUDFLARE_LLM_MODEL,
        embedding_model: str = DEFAULT_CLOUDFLARE_EMBEDDING_MODEL,
        timeout_seconds: float = 30,
    ) -> None:
        self.account_id = account_id
        self.api_token = api_token
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_environment(cls) -> CloudflareWorkersAIClient:
        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
        api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        if not account_id or not api_token:
            raise CloudflareAIConfigurationError(
                "Cloudflare Workers AI credentials are not fully configured."
            )
        return cls(
            account_id=account_id,
            api_token=api_token,
            llm_model=os.environ.get(
                "CLOUDFLARE_LLM_MODEL",
                DEFAULT_CLOUDFLARE_LLM_MODEL,
            ).strip(),
            embedding_model=os.environ.get(
                "CLOUDFLARE_EMBEDDING_MODEL",
                DEFAULT_CLOUDFLARE_EMBEDDING_MODEL,
            ).strip(),
            timeout_seconds=float(os.environ.get("CLOUDFLARE_AI_TIMEOUT_SECONDS", "30")),
        )

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_content: str,
        json_schema: dict[str, Any],
        max_tokens: int = 1800,
        temperature: float = 0,
    ) -> str:
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": json_schema,
            },
        }
        response = self._run_model(self.llm_model, payload)
        result = response.get("result")
        if not isinstance(result, dict):
            raise CloudflareAIError("Workers AI response did not contain a result object.")
        content = result.get("response")
        if isinstance(content, dict):
            return json.dumps(content)
        if isinstance(content, str):
            return content
        raise CloudflareAIError("Workers AI structured response was not understood.")

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        response = self._run_model(self.embedding_model, {"text": list(texts)})
        result = response.get("result")
        if not isinstance(result, dict):
            raise CloudflareAIError("Workers AI embedding response did not contain a result.")
        data = result.get("data")
        if not isinstance(data, list):
            raise CloudflareAIError("Workers AI embedding data was not understood.")

        if data and all(isinstance(value, (int, float)) for value in data):
            vectors: list[object] = [data]
        else:
            vectors = data
        parsed = [self._parse_vector(vector) for vector in vectors]
        if len(parsed) != len(texts):
            raise CloudflareAIError("Workers AI returned an unexpected embedding count.")
        return parsed

    def _run_model(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        endpoint = (
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{quote(self.account_id, safe='')}/ai/run/{quote(model, safe='@/')}"
        )
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        for attempt in range(2):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    parsed = json.loads(response.read())
                if not isinstance(parsed, dict):
                    raise CloudflareAIError("Workers AI returned a non-object response.")
                if parsed.get("success") is False:
                    raise CloudflareAIError(error_message(parsed))
                return parsed
            except HTTPError as exc:
                if exc.code == 429 or exc.code < 500 or attempt == 1:
                    raise CloudflareAIError(http_error_message(exc)) from exc
            except (URLError, TimeoutError, json.JSONDecodeError) as exc:
                if attempt == 1:
                    raise CloudflareAIError("Workers AI request failed.") from exc
            time.sleep(0.25 * (attempt + 1))

        raise CloudflareAIError("Workers AI request failed.")

    @staticmethod
    def _parse_vector(value: object) -> list[float]:
        if not isinstance(value, list) or not value:
            raise CloudflareAIError("Workers AI returned an invalid embedding vector.")
        if not all(isinstance(item, (int, float)) for item in value):
            raise CloudflareAIError("Workers AI returned a non-numeric embedding vector.")
        return [float(item) for item in value]


def error_message(payload: dict[str, Any]) -> str:
    errors = payload.get("errors")
    if isinstance(errors, list):
        for error in errors:
            if isinstance(error, dict) and isinstance(error.get("message"), str):
                return error["message"]
    return "Workers AI request was rejected."


def http_error_message(error: HTTPError) -> str:
    try:
        payload = json.loads(error.read())
    except (json.JSONDecodeError, OSError):
        return f"Workers AI request failed with status {error.code}."
    if isinstance(payload, dict):
        return error_message(payload)
    return f"Workers AI request failed with status {error.code}."
