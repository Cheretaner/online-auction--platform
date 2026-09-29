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
