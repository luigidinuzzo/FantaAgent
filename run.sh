#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

( sleep 6 && command -v open >/dev/null && open http://localhost:8080 ) &
exec mvn -q -DskipTests spring-boot:run
