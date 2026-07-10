export const JSON_HEADERS = {
  "Content-Type": "application/json",
} as const;

export async function apiError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = typeof body?.detail === "string" ? body.detail : null;
  return new Error(detail ?? `${fallback} (${response.status}).`);
}
