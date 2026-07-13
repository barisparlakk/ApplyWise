#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the PostgreSQL database to back up.}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY must be set.}"

for command_name in pg_dump pg_restore openssl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

backup_dir="${BACKUP_DIR:-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$(mktemp "${TMPDIR:-/tmp}/applywise-backup.XXXXXX.dump")"
encrypted_file="${backup_dir}/applywise-${timestamp}.dump.enc"
checksum_file="${encrypted_file}.sha256"

cleanup() {
  rm -f "$archive"
}
trap cleanup EXIT

umask 077
mkdir -p "$backup_dir"

pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$archive"

pg_restore --list "$archive" >/dev/null

openssl enc \
  -aes-256-cbc \
  -salt \
  -pbkdf2 \
  -iter 250000 \
  -in "$archive" \
  -out "$encrypted_file" \
  -pass env:BACKUP_ENCRYPTION_KEY

if command -v sha256sum >/dev/null 2>&1; then
  digest="$(sha256sum "$encrypted_file" | awk '{print $1}')"
else
  digest="$(shasum -a 256 "$encrypted_file" | awk '{print $1}')"
fi
printf '%s  %s\n' "$digest" "$(basename "$encrypted_file")" > "$checksum_file"

printf 'Encrypted backup created: %s\n' "$encrypted_file"
printf 'Checksum created: %s\n' "$checksum_file"
