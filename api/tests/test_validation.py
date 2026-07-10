from __future__ import annotations

import pytest

from applywise.validation import bounded_text_values, optional_http_url


def test_optional_http_url_rejects_unsafe_schemes() -> None:
    with pytest.raises(ValueError, match="http or https"):
        optional_http_url("javascript:alert(1)")

    assert optional_http_url(" https://example.com/jobs/1 ") == "https://example.com/jobs/1"


def test_bounded_text_values_enforces_item_count_and_length() -> None:
    assert bounded_text_values([" Python ", ""], max_items=2, max_item_length=20) == [
        "Python"
    ]

    with pytest.raises(ValueError, match="No more than 1"):
        bounded_text_values(["Python", "SQL"], max_items=1, max_item_length=20)

    with pytest.raises(ValueError, match="at most 3"):
        bounded_text_values(["FastAPI"], max_items=1, max_item_length=3)
