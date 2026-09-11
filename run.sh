#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Backend su :8080 — API e /legacy. Frontend React: dev server su :5173" \
     "(cd frontend && npm run dev), oppure il jar impacchettato con mvn -Pprod package."
exec mvn -q -DskipTests spring-boot:run
