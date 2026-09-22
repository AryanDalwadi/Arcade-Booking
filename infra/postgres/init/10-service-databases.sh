#!/bin/sh
set -eu

# Runs only when PostgreSQL initializes an empty data volume. Entries use
# database:owner:password. Identifiers are restricted before SQL identifiers
# and password literals are quoted by PostgreSQL's format() function.
entries="${POSTGRES_SERVICE_DATABASES:-}"
[ -n "$entries" ] || { return 0 2>/dev/null || exit 0; }

old_ifs="$IFS"
IFS=','
for entry in $entries; do
  IFS=':' read -r database owner password <<EOF
$entry
EOF
  IFS=','

  database="$(printf '%s' "$database" | tr -d '[:space:]')"
  owner="$(printf '%s' "$owner" | tr -d '[:space:]')"

  case "$database:$owner" in
    *[!a-z0-9_:]*|'':*|*:'')
      echo "Invalid database or owner in POSTGRES_SERVICE_DATABASES" >&2
      exit 1
      ;;
  esac

  if [ -z "$password" ]; then
    echo "Missing password for database '$database'" >&2
    exit 1
  fi

  psql --username "$POSTGRES_USER" --dbname postgres \
    --set=ON_ERROR_STOP=1 \
    --set=database="$database" \
    --set=owner="$owner" \
    --set=password="$password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'owner', :'password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'owner') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'database', :'owner')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database') \gexec

SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'database', :'owner') \gexec
SQL
done
IFS="$old_ifs"
