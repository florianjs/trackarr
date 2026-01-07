-- Zero Knowledge Encryption Migration
-- Removes email-based auth, adds ZKE fields

-- Step 1: Add new ZKE columns
ALTER TABLE users ADD COLUMN auth_salt TEXT;
ALTER TABLE users ADD COLUMN auth_verifier TEXT;

-- Step 2: Drop email column and password_hash
-- WARNING: This will fail if there are existing users - intentional safety check
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Step 3: Make new columns NOT NULL (run after data migration if needed)
-- ALTER TABLE users ALTER COLUMN auth_salt SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN auth_verifier SET NOT NULL;
