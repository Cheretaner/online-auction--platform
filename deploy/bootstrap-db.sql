-- Creates the application role and database. Run once as the postgres
-- superuser; provision.sh does this for you:
--
--   sudo -u postgres psql -v db_password="'...'" -f deploy/bootstrap-db.sql
--
-- The API connects as the OWNER of its schema. That is deliberate: owners
-- bypass row-level security, and the RLS policies from migration 002 are
-- read-side defence in depth, not the primary authorization layer (see
-- packages/api/README.md, "Row-level security").

SELECT 'CREATE ROLE auction LOGIN PASSWORD ' || :'db_password'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auction')
\gexec

SELECT 'CREATE DATABASE auction OWNER auction'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auction')
\gexec

\connect auction
-- pgcrypto supplies gen_random_uuid()/digest(); creating it here means the
-- migrations never need superuser rights.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER SCHEMA public OWNER TO auction;
-- Bootstrap script for database
-- Note: Migrations are run by the app on boot (RUN_MIGRATIONS_ON_BOOT=true)

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'auction_app') THEN
      CREATE ROLE auction_app LOGIN PASSWORD 'your_secure_password_here';
   END IF;
END
$do$;

-- For PostgreSQL 15+, public schema permissions have changed, 
-- we must grant CREATE to the role.
GRANT ALL PRIVILEGES ON DATABASE auction TO auction_app;
GRANT ALL PRIVILEGES ON SCHEMA public TO auction_app;
GRANT CREATE ON SCHEMA public TO auction_app;
