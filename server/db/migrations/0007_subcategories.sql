-- Add subcategories support
-- Remove unique constraint on name to allow same name in different parents
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";

-- Add parent_id column for hierarchical categories
ALTER TABLE "categories" ADD COLUMN "parent_id" text;

-- Add foreign key constraint (self-referencing)
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fk" 
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE;

-- Add index for efficient parent lookups
CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" ("parent_id");

-- Add unique constraint on (parent_id, name) to prevent duplicates within same parent
CREATE UNIQUE INDEX "categories_parent_name_idx" ON "categories" (COALESCE("parent_id", ''), "name");
