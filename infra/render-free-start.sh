#!/usr/bin/env bash
set -Eeuo pipefail

api_pid=""
web_pid=""
worker_pid=""

cleanup() {
  trap - EXIT
  for pid in "$web_pid" "$worker_pid" "$api_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 143' INT TERM

if [[ -z "${NEXTAUTH_URL:-}" && -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]]; then
  export NEXTAUTH_URL="https://${RENDER_EXTERNAL_HOSTNAME}"
fi

if [[ -z "${CORS_ORIGINS:-}" && -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]]; then
  export CORS_ORIGINS="https://${RENDER_EXTERNAL_HOSTNAME}"
fi

export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:8000}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-127.0.0.1,localhost}"

node /app/web/scripts/validate-runtime-env.mjs

cd /app/api
python -m applywise.migrations
uvicorn applywise.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --workers "${WEB_CONCURRENCY:-1}" &
api_pid=$!

if [[ "${BACKGROUND_JOBS_ENABLED:-false}" == "true" ]]; then
  python -m applywise.worker &
  worker_pid=$!
fi

cd /app/web
node server.js &
web_pid=$!

process_ids=("$api_pid" "$web_pid")
if [[ -n "$worker_pid" ]]; then
  process_ids+=("$worker_pid")
fi

set +e
wait -n "${process_ids[@]}"
exit_code=$?
set -e

exit "$exit_code"
