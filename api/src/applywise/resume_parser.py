from __future__ import annotations

import json
import os
from io import BytesIO
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pdfplumber
from docx import Document
from pydantic import BaseModel, Field, ValidationError
from pypdf import PdfReader


class ParsedResume(BaseModel):
    education: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)


class StructuredResumeProvider(Protocol):
    def extract_resume_json(self, text: str) -> str:
        pass


class ResumeExtractionError(RuntimeError):
    pass


class LocalStructuredResumeProvider:
    section_names = {
        "education": "education",
        "experience": "experience",
        "work experience": "experience",
        "professional experience": "experience",
        "skills": "skills",
        "technical skills": "skills",
        "projects": "projects",
        "selected projects": "projects",
    }

    def extract_resume_json(self, text: str) -> str:
        sections = extract_sections_heuristically(text)
        return json.dumps(sections)


class OpenAICompatibleStructuredResumeProvider:
    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 30,
    ) -> None:
        self.api_url = api_url
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def extract_resume_json(self, text: str) -> str:
        payload = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Extract resume sections as JSON only. "
                        "Return exactly these keys with string-array values: "
                        "education, experience, skills, projects."
                    ),
                },
                {"role": "user", "content": text},
            ],
        }
        request = Request(
            self.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                response_data = json.loads(response.read())
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ResumeExtractionError("LLM resume extraction request failed.") from exc

        content = extract_llm_message_content(response_data)
        if content is None:
            raise ResumeExtractionError("LLM resume extraction response was not understood.")
        return content


def get_structured_resume_provider() -> StructuredResumeProvider:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return LocalStructuredResumeProvider()

    if provider in {"openai", "openai-compatible"}:
        api_url = os.environ.get("LLM_API_URL", "").strip()
        api_key = os.environ.get("LLM_API_KEY", "").strip()
        model = os.environ.get("LLM_MODEL", "").strip()
        if not api_url or not api_key or not model:
            raise ResumeExtractionError("LLM provider is not fully configured.")

        timeout_seconds = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30"))
        return OpenAICompatibleStructuredResumeProvider(
            api_url=api_url,
            api_key=api_key,
            model=model,
            timeout_seconds=timeout_seconds,
        )

    raise ResumeExtractionError(f"Unsupported LLM provider: {provider}.")


def extract_llm_message_content(response_data: object) -> str | None:
    if not isinstance(response_data, dict):
        return None

    choices = response_data.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0]
        if isinstance(first_choice, dict):
            message = first_choice.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]

    output_text = response_data.get("output_text")
    if isinstance(output_text, str):
        return output_text

    if all(key in response_data for key in ParsedResume.model_fields):
        return json.dumps(response_data)

    return None


def parse_cv_file(filename: str, content: bytes) -> str:
    lower_filename = filename.lower()
    if lower_filename.endswith(".pdf"):
        return parse_pdf(content)
    if lower_filename.endswith(".docx"):
        return parse_docx(content)
    raise ResumeExtractionError("Unsupported resume file type.")


def parse_pdf(content: bytes) -> str:
    texts: list[str] = []
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    texts.append(page_text)
    except Exception:
        texts = []

    if texts:
        return "\n".join(texts).strip()

    reader = PdfReader(BytesIO(content))
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            texts.append(page_text)
    return "\n".join(texts).strip()


def parse_docx(content: bytes) -> str:
    document = Document(BytesIO(content))
    lines: list[str] = []
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            lines.append(text)

    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append(" | ".join(cells))

    return "\n".join(lines)


def extract_structured_resume(
    text: str,
    provider: StructuredResumeProvider | None = None,
) -> ParsedResume:
    extractor = provider or get_structured_resume_provider()
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            return ParsedResume.model_validate_json(extractor.extract_resume_json(text))
        except (ValidationError, ValueError) as exc:
            last_error = exc

    raise ResumeExtractionError("Resume parser returned invalid structured output.") from last_error


def extract_sections_heuristically(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {
        "education": [],
        "experience": [],
        "skills": [],
        "projects": [],
    }
    current_section: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip(" -\t")
        if not line:
            continue

        key = line.rstrip(":").lower()
        if key in LocalStructuredResumeProvider.section_names:
            current_section = LocalStructuredResumeProvider.section_names[key]
            continue

        if current_section is not None:
            sections[current_section].append(line)

    sections["skills"] = normalize_skills(sections["skills"])
    return sections


def normalize_skills(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    skills: list[str] = []
    for line in lines:
        for part in line.replace("|", ",").split(","):
            skill = part.strip()
            key = skill.lower()
            if skill and key not in seen:
                seen.add(key)
                skills.append(skill)
    return skills
