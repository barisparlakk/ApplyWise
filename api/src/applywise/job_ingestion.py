from __future__ import annotations

import html
import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_DESCRIPTION_CHARS = 48_000
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
GREENHOUSE_JOB_PATTERN = re.compile(r"^[0-9]{1,20}$")
LEVER_JOB_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,80}$")

JsonFetcher = Callable[[str], object]


class JobIngestionError(RuntimeError):
    pass


class UnsupportedJobSourceError(JobIngestionError):
    pass


class JobSourceFetchError(JobIngestionError):
    pass


@dataclass(frozen=True)
class JobSourceReference:
    source: Literal["greenhouse", "lever"]
    account: str
    job_id: str
    api_url: str


@dataclass(frozen=True)
class ImportedJobPost:
    source: Literal["greenhouse", "lever"]
    company_name: str
    title: str
    description: str
    location: str | None
    source_url: str

    def analysis_text(self) -> str:
        header = [f"Company: {self.company_name}", f"Position: {self.title}"]
        if self.location:
            header.append(f"Location: {self.location}")
        return "\n".join([*header, "", self.description])[:50_000]


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(
        self,
        _req: Request,
        _fp: object,
        _code: int,
        _msg: str,
        _headers: object,
        _newurl: str,
    ) -> None:
        return None


class PlainTextHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"br", "p", "div", "section", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")
        if tag == "li":
            self.parts.append("- ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"p", "div", "section", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        lines = [" ".join(line.split()) for line in "".join(self.parts).splitlines()]
        return "\n".join(line for line in lines if line).strip()


def import_job_post(
    source_url: str,
    *,
    fetch_json: JsonFetcher | None = None,
) -> ImportedJobPost:
    reference = parse_job_source_url(source_url)
    payload = (fetch_json or request_json)(reference.api_url)
    if not isinstance(payload, dict):
        raise JobSourceFetchError("The job source returned an unexpected response.")
    if reference.source == "greenhouse":
        return parse_greenhouse_job(payload, reference, source_url)
    return parse_lever_job(payload, reference, source_url)


def parse_job_source_url(source_url: str) -> JobSourceReference:
    parsed = urlparse(source_url.strip())
    hostname = (parsed.hostname or "").casefold().rstrip(".")
    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsupportedJobSourceError("The job URL port is invalid.") from exc
    if (
        parsed.scheme != "https"
        or parsed.username is not None
        or parsed.password is not None
        or port not in {None, 443}
    ):
        raise UnsupportedJobSourceError("Only supported HTTPS job URLs can be imported.")
    parts = [part for part in parsed.path.split("/") if part]

    if hostname in {"boards.greenhouse.io", "job-boards.greenhouse.io"}:
        if (
            len(parts) != 3
            or parts[1] != "jobs"
            or not TOKEN_PATTERN.fullmatch(parts[0])
            or not GREENHOUSE_JOB_PATTERN.fullmatch(parts[2])
        ):
            raise UnsupportedJobSourceError("The Greenhouse job URL is not recognized.")
        account, job_id = parts[0], parts[2]
        return JobSourceReference(
            source="greenhouse",
            account=account,
            job_id=job_id,
            api_url=(
                f"https://boards-api.greenhouse.io/v1/boards/{account}/jobs/{job_id}"
            ),
        )

    lever_api_host = {
        "jobs.lever.co": "api.lever.co",
        "jobs.eu.lever.co": "api.eu.lever.co",
    }.get(hostname)
    if lever_api_host:
        if (
            len(parts) != 2
            or not TOKEN_PATTERN.fullmatch(parts[0])
            or not LEVER_JOB_PATTERN.fullmatch(parts[1])
        ):
            raise UnsupportedJobSourceError("The Lever job URL is not recognized.")
        account, job_id = parts
        return JobSourceReference(
            source="lever",
            account=account,
            job_id=job_id,
            api_url=f"https://{lever_api_host}/v0/postings/{account}/{job_id}",
        )

    raise UnsupportedJobSourceError(
        "Only public Greenhouse and Lever job URLs are supported."
    )


def request_json(url: str) -> object:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ApplyWise/1.0 job-import",
        },
    )
    opener = build_opener(NoRedirectHandler())
    try:
        with opener.open(request, timeout=12) as response:
            payload = response.read(MAX_RESPONSE_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise JobSourceFetchError("The official job source could not be reached.") from exc
    if len(payload) > MAX_RESPONSE_BYTES:
        raise JobSourceFetchError("The job source response is too large.")
    try:
        return json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise JobSourceFetchError("The job source did not return valid JSON.") from exc


def parse_greenhouse_job(
    payload: dict[str, object],
    reference: JobSourceReference,
    source_url: str,
) -> ImportedJobPost:
    title = required_text(payload.get("title"), "Greenhouse job title")
    description = html_to_text(required_text(payload.get("content"), "Greenhouse content"))
    location_payload = payload.get("location")
    location = (
        optional_text(location_payload.get("name"))
        if isinstance(location_payload, dict)
        else None
    )
    company = optional_text(payload.get("company_name")) or humanize_account(reference.account)
    return ImportedJobPost(
        source="greenhouse",
        company_name=company,
        title=title,
        description=description[:MAX_DESCRIPTION_CHARS],
        location=location,
        source_url=source_url.strip(),
    )


def parse_lever_job(
    payload: dict[str, object],
    reference: JobSourceReference,
    source_url: str,
) -> ImportedJobPost:
    title = required_text(payload.get("text"), "Lever job title")
    description = optional_text(payload.get("descriptionPlain"))
    if not description:
        description = html_to_text(required_text(payload.get("description"), "Lever content"))
    categories = payload.get("categories")
    location = optional_text(categories.get("location")) if isinstance(categories, dict) else None
    return ImportedJobPost(
        source="lever",
        company_name=humanize_account(reference.account),
        title=title,
        description=description[:MAX_DESCRIPTION_CHARS],
        location=location,
        source_url=source_url.strip(),
    )


def html_to_text(value: str) -> str:
    parser = PlainTextHTMLParser()
    parser.feed(html.unescape(html.unescape(value)))
    parser.close()
    return parser.text()


def required_text(value: object, label: str) -> str:
    text = optional_text(value)
    if not text:
        raise JobSourceFetchError(f"{label} is missing.")
    return text


def optional_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = " ".join(value.split())
    return stripped or None


def humanize_account(value: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[-_]", value) if part)
