from __future__ import annotations

from urllib.parse import urlparse


def optional_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None

    parsed = urlparse(stripped)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must use http or https.")
    return stripped


def bounded_text_values(
    values: list[str],
    *,
    max_items: int,
    max_item_length: int,
) -> list[str]:
    if len(values) > max_items:
        raise ValueError(f"No more than {max_items} items are allowed.")

    cleaned: list[str] = []
    for value in values:
        stripped = value.strip()
        if len(stripped) > max_item_length:
            raise ValueError(f"Each item must be at most {max_item_length} characters.")
        if stripped:
            cleaned.append(stripped)
    return cleaned
