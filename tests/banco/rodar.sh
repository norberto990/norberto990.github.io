#!/bin/bash
# Roda os testes do banco num Postgres vazio. Uso: tests/banco/rodar.sh "postgresql://usuario@servidor/banco"
set -e
cd "$(dirname "$0")"
psql "$1" -q -v ON_ERROR_STOP=1 -o /dev/null -f supabase-simulado.sql -f ../../supabase/schema.sql -f ../../supabase/schema.sql -f dados.sql -f regras.test.sql 2>&1 \
  | grep -v -E "wal_level|HINT|already exists, skipping|does not exist, skipping" | sed 's/^psql:[^ ]* NOTICE:  //'
exit "${PIPESTATUS[0]}"
