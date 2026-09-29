#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Portale su :8080 (API). Frontend React: dev server su :5173 (cd frontend && npm run dev)." \
     "Database locale in ${FANTAAGENT_DB_DIR:-data/pg}; le email finiscono nel log."
# Il classpath dei test porta il Postgres incorporato (EmbeddedPostgresConfig): il jar
# di produzione non lo contiene, e li' il database arriva da FANTAAGENT_DB_URL.
# useTestClasspath aggiunge solo le dipendenze di test (i binari di Postgres): le classi
# e le proprieta' compilate dei test, EmbeddedPostgresConfig compresa, vanno indicate a parte.
exec mvn -q -DskipTests spring-boot:run \
  -Dspring-boot.run.useTestClasspath=true \
  -Dspring-boot.run.additional-classpath-elements=target/test-classes \
  -Dspring-boot.run.profiles=local
