#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${1:-${PRODUCTION_URL:-}}"
if [[ -z "$base_url" ]]; then
  printf 'Usage: %s https://applywise.example.com\n' "$0" >&2
  exit 2
fi
base_url="${base_url%/}"
if [[ "$base_url" != https://* ]]; then
  printf 'Production smoke tests require an HTTPS URL.\n' >&2
  exit 2
fi

headers="$(mktemp)"
body="$(mktemp)"
cleanup() {
  rm -f "$headers" "$body"
}
trap cleanup EXIT

curl_options=(
  --silent
  --show-error
  --location
  --fail-with-body
  --connect-timeout 15
  --max-time 180
  --retry 5
  --retry-delay 10
  --retry-all-errors
)

curl "${curl_options[@]}" -D "$headers" -o "$body" "${base_url}/api/health"
if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$body"; then
  printf 'Health endpoint returned an unexpected body:\n' >&2
  cat "$body" >&2
  exit 1
fi

curl "${curl_options[@]}" -D "$headers" -o /dev/null "${base_url}/login"
for header_name in content-security-policy strict-transport-security x-content-type-options; do
  if ! grep -qi "^${header_name}:" "$headers"; then
    printf 'Missing production security header: %s\n' "$header_name" >&2
    exit 1
  fi
done

curl "${curl_options[@]}" -o /dev/null "${base_url}/privacy"
printf 'Production smoke checks passed: %s\n' "$base_url"
