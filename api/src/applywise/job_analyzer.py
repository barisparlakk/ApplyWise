from __future__ import annotations

import json
import os
import re
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, ValidationError, field_validator

TECH_SKILLS = (
    "Python",
    "SQL",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "FastAPI",
    "Django",
    "Flask",
    "Node.js",
    "PostgreSQL",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "Pandas",
    "NumPy",
    "scikit-learn",
    "TensorFlow",
    "PyTorch",
    "Machine Learning",
    "LLM",
    "RAG",
    "Git",
    "CI/CD",
    "REST",
    "GraphQL",
)

SECTION_BOUNDARIES = {
    "responsibilities",
    "what you will do",
    "tasks",
    "requirements",
    "required",
    "must have",
    "qualifications",
    "what you need",
    "nice to have",
    "preferred",
    "bonus",
    "plus",
    "good to have",
    "about you",
    "benefits",
    "about us",
}


class JobPostAnalysis(BaseModel):
    role_title: str = Field(min_length=1, max_length=255)
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    seniority_level: str = Field(default="Internship", max_length=120)
    domain: str = Field(default="Software", max_length=120)
    hidden_expectations: list[str] = Field(default_factory=list)
    english_requirement: str = Field(default="Not specified", max_length=120)
    technical_difficulty: str = Field(default="Medium", max_length=120)
    business_expectations: list[str] = Field(default_factory=list)
    communication_expectations: list[str] = Field(default_factory=list)

    @field_validator(
        "required_skills",
        "nice_to_have_skills",
        "responsibilities",
        "hidden_expectations",
        "business_expectations",
        "communication_expectations",
    )
    @classmethod
    def normalize_items(cls, values: list[str]) -> list[str]:
        return unique_values(values)

    @field_validator(
        "role_title",
        "seniority_level",
        "domain",
        "english_requirement",
        "technical_difficulty",
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() or "Not specified"


class StructuredJobProvider(Protocol):
    def analyze_job_json(self, text: str) -> str:
        pass


class JobAnalysisError(RuntimeError):
    pass


class LocalStructuredJobProvider:
    def analyze_job_json(self, text: str) -> str:
        return json.dumps(extract_job_heuristically(text))


class OpenAICompatibleStructuredJobProvider:
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

    def analyze_job_json(self, text: str) -> str:
        payload = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Analyze the pasted internship job post as JSON only. "
                        "Return exactly these keys: role_title, required_skills, "
                        "nice_to_have_skills, responsibilities, seniority_level, domain, "
                        "hidden_expectations, english_requirement, technical_difficulty, "
                        "business_expectations, communication_expectations. "
                        "Use string arrays for list fields. Do not invent facts."
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
            raise JobAnalysisError("LLM job analysis request failed.") from exc

        content = extract_llm_message_content(response_data)
        if content is None:
            raise JobAnalysisError("LLM job analysis response was not understood.")
        return content


def analyze_job_post(
    text: str,
    provider: StructuredJobProvider | None = None,
) -> JobPostAnalysis:
    extractor = provider or get_structured_job_provider()
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            return JobPostAnalysis.model_validate_json(extractor.analyze_job_json(text))
        except (ValidationError, ValueError) as exc:
            last_error = exc

    raise JobAnalysisError("Job analyzer returned invalid structured output.") from last_error


def get_structured_job_provider() -> StructuredJobProvider:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return LocalStructuredJobProvider()

    if provider in {"openai", "openai-compatible"}:
        api_url = os.environ.get("LLM_API_URL", "").strip()
        api_key = os.environ.get("LLM_API_KEY", "").strip()
        model = os.environ.get("LLM_MODEL", "").strip()
        if not api_url or not api_key or not model:
            raise JobAnalysisError("LLM provider is not fully configured.")

        timeout_seconds = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30"))
        return OpenAICompatibleStructuredJobProvider(
            api_url=api_url,
            api_key=api_key,
            model=model,
            timeout_seconds=timeout_seconds,
        )

    raise JobAnalysisError(f"Unsupported LLM provider: {provider}.")


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

    if all(key in response_data for key in JobPostAnalysis.model_fields):
        return json.dumps(response_data)

    return None


def extract_job_heuristically(text: str) -> dict[str, object]:
    lines = [line.strip(" -\t") for line in text.splitlines() if line.strip(" -\t")]
    lower_text = text.lower()
    required_skills = infer_required_skills(text)
    nice_to_have_skills = infer_nice_to_have_skills(text, required_skills)
    responsibilities = infer_responsibilities(lines)

    return {
        "role_title": infer_role_title(lines),
        "required_skills": required_skills,
        "nice_to_have_skills": nice_to_have_skills,
        "responsibilities": responsibilities,
        "seniority_level": infer_seniority_level(lower_text),
        "domain": infer_domain(lower_text, required_skills),
        "hidden_expectations": infer_hidden_expectations(lower_text),
        "english_requirement": infer_english_requirement(lower_text),
        "technical_difficulty": infer_technical_difficulty(required_skills, lower_text),
        "business_expectations": infer_business_expectations(lower_text),
        "communication_expectations": infer_communication_expectations(lower_text),
    }


def infer_role_title(lines: list[str]) -> str:
    title_patterns = (
        r"(?:role|title|position|job title)\s*:\s*(.+)",
        r"(.+\b(?:intern|internship|engineer|developer|analyst|scientist)\b.*)",
    )
    for line in lines[:12]:
        for pattern in title_patterns:
            match = re.search(pattern, line, flags=re.IGNORECASE)
            if match:
                return clean_title(match.group(1))
    return "Internship role"


def clean_title(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip(" .:-")
    return cleaned[:255] or "Internship role"


def infer_required_skills(text: str) -> list[str]:
    lower_text = text.lower()
    required_window = section_window(
        text,
        ("requirements", "required", "must have", "qualifications", "what you need"),
    )
    source = required_window or text
    skills = [skill for skill in TECH_SKILLS if skill.lower() in source.lower()]

    if "machine learning" in lower_text and "Machine Learning" not in skills:
        skills.append("Machine Learning")
    if "large language" in lower_text and "LLM" not in skills:
        skills.append("LLM")
    return unique_values(skills)


def infer_nice_to_have_skills(text: str, required_skills: list[str]) -> list[str]:
    nice_window = section_window(
        text,
        ("nice to have", "preferred", "bonus", "plus", "good to have"),
    )
    if not nice_window:
        return []

    required_keys = {skill.lower() for skill in required_skills}
    skills = [
        skill
        for skill in TECH_SKILLS
        if skill.lower() in nice_window.lower() and skill.lower() not in required_keys
    ]
    return unique_values(skills)


def infer_responsibilities(lines: list[str]) -> list[str]:
    responsibilities: list[str] = []
    in_responsibility_section = False
    for line in lines:
        lower_line = line.lower().rstrip(":")
        if lower_line in {"responsibilities", "what you will do", "tasks", "role"}:
            in_responsibility_section = True
            continue
        if lower_line in {"requirements", "qualifications", "skills", "preferred"}:
            in_responsibility_section = False
        if in_responsibility_section or starts_with_action(line):
            responsibilities.append(line)
    return unique_values(responsibilities[:8]) or ["Contribute to the team's internship work."]


def starts_with_action(line: str) -> bool:
    first_word = line.split(" ", maxsplit=1)[0].lower().strip(":")
    return first_word in {
        "build",
        "develop",
        "analyze",
        "create",
        "support",
        "collaborate",
        "design",
        "implement",
        "maintain",
        "document",
        "improve",
    }


def infer_seniority_level(lower_text: str) -> str:
    if "intern" in lower_text or "internship" in lower_text:
        return "Internship"
    if "junior" in lower_text or "entry" in lower_text:
        return "Junior"
    if "senior" in lower_text or "lead" in lower_text:
        return "Senior"
    return "Not specified"


def infer_domain(lower_text: str, skills: list[str]) -> str:
    skill_text = " ".join(skills).lower()
    if any(term in lower_text or term in skill_text for term in ("machine learning", "ai", "llm")):
        return "AI/ML"
    if any(
        term in lower_text
        for term in ("data", "analytics", "dashboard", "business intelligence")
    ):
        return "Data/Analytics"
    if any(term in lower_text for term in ("backend", "api", "microservice")):
        return "Backend"
    if any(term in lower_text for term in ("image", "vision", "opencv")):
        return "Image Processing"
    if any(term in lower_text for term in ("process", "workflow", "operations")):
        return "Process Improvement"
    return "Software"


def infer_hidden_expectations(lower_text: str) -> list[str]:
    expectations: list[str] = []
    if "fast-paced" in lower_text or "startup" in lower_text:
        expectations.append("Comfortable with ambiguity and fast iteration")
    if "cross-functional" in lower_text or "stakeholder" in lower_text:
        expectations.append("Can work across product, engineering, and business teams")
    if "ownership" in lower_text or "independent" in lower_text:
        expectations.append("Expected to own tasks with limited supervision")
    if "production" in lower_text or "scalable" in lower_text:
        expectations.append("Awareness of production-quality engineering")
    if "research" in lower_text or "explore" in lower_text:
        expectations.append("Able to learn unfamiliar technical areas quickly")
    return expectations or ["Ability to learn quickly and turn vague tasks into deliverables"]


def infer_english_requirement(lower_text: str) -> str:
    if any(term in lower_text for term in ("fluent english", "excellent english", "c1")):
        return "High"
    if any(term in lower_text for term in ("english", "written and verbal", "communication")):
        return "Working proficiency"
    return "Not specified"


def infer_technical_difficulty(skills: list[str], lower_text: str) -> str:
    advanced_terms = {"kubernetes", "rag", "llm", "pytorch", "tensorflow", "microservice"}
    skill_keys = {skill.lower() for skill in skills}
    if len(skills) >= 7 or advanced_terms & skill_keys:
        return "High"
    if len(skills) >= 3 or any(
        term in lower_text for term in ("production", "scale", "architecture")
    ):
        return "Medium"
    return "Low"


def infer_business_expectations(lower_text: str) -> list[str]:
    expectations: list[str] = []
    if any(term in lower_text for term in ("customer", "user", "client")):
        expectations.append("Understand user or customer impact")
    if any(term in lower_text for term in ("kpi", "metric", "business", "revenue")):
        expectations.append("Connect technical work to measurable business outcomes")
    if any(term in lower_text for term in ("process", "operation", "workflow")):
        expectations.append("Improve operational workflows")
    return expectations or ["Explain why technical work matters to the team"]


def infer_communication_expectations(lower_text: str) -> list[str]:
    expectations: list[str] = []
    if any(term in lower_text for term in ("present", "presentation", "demo")):
        expectations.append("Present work clearly to teammates or stakeholders")
    if any(term in lower_text for term in ("document", "documentation", "write")):
        expectations.append("Document implementation decisions")
    if any(term in lower_text for term in ("collaborate", "cross-functional", "stakeholder")):
        expectations.append("Collaborate across functions")
    if "english" in lower_text:
        expectations.append("Communicate in English in written or spoken form")
    return expectations or ["Communicate progress, blockers, and tradeoffs clearly"]


def section_window(text: str, headings: tuple[str, ...]) -> str:
    lines = text.splitlines()
    collected: list[str] = []
    collecting = False
    for line in lines:
        stripped = line.strip()
        lower_line = stripped.lower().rstrip(":")
        if any(heading in lower_line for heading in headings):
            collecting = True
            continue
        if collecting and is_section_boundary(lower_line, headings):
            break
        if collecting:
            collected.append(stripped)
    return "\n".join(collected)


def is_section_boundary(lower_line: str, active_headings: tuple[str, ...]) -> bool:
    if not lower_line:
        return False
    if any(heading in lower_line for heading in active_headings):
        return False
    return any(boundary == lower_line or boundary in lower_line for boundary in SECTION_BOUNDARIES)


def unique_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        stripped = re.sub(r"\s+", " ", value).strip(" .:-")
        key = stripped.lower()
        if stripped and key not in seen:
            seen.add(key)
            unique.append(stripped)
    return unique
