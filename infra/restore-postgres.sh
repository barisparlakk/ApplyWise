#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-verify}"
backup_file="${2:-}"

if [[ "$mode" != "verify" && "$mode" != "restore" ]]; then
  printf 'Usage: %s verify|restore BACKUP_FILE\n' "$0" >&2
  exit 2
fi
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  printf 'Backup file does not exist: %s\n' "$backup_file" >&2
  exit 2
fi

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY must be set.}"

checksum_file="${backup_file}.sha256"
if [[ -f "$checksum_file" ]]; then
  backup_dir="$(cd "$(dirname "$backup_file")" && pwd)"
  checksum_name="$(basename "$checksum_file")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$backup_dir" && sha256sum --check "$checksum_name")
  else
    (cd "$backup_dir" && shasum -a 256 --check "$checksum_name")
  fi
fi

archive="$(mktemp "${TMPDIR:-/tmp}/applywise-restore.XXXXXX.dump")"
cleanup() {
  rm -f "$archive"
}
trap cleanup EXIT

openssl enc \
  -d \
  -aes-256-cbc \
  -pbkdf2 \
  -iter 250000 \
  -in "$backup_file" \
  -out "$archive" \
  -pass env:BACKUP_ENCRYPTION_KEY

pg_restore --list "$archive" >/dev/null

if [[ "$mode" == "verify" ]]; then
  printf 'Backup is decryptable and has a valid PostgreSQL archive: %s\n' "$backup_file"
  exit 0
fi

: "${DATABASE_URL:?DATABASE_URL must point to the restore target.}"
if [[ "${RESTORE_CONFIRM:-}" != "restore-applywise" ]]; then
  printf 'Set RESTORE_CONFIRM=restore-applywise to run a destructive restore.\n' >&2
  exit 2
fi

pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$archive"

printf 'Restore completed from: %s\n' "$backup_file"
