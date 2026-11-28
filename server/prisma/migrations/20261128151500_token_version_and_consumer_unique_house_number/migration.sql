-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Deduplicate any existing duplicate houseNumbers within the same GP prior to applying unique index
UPDATE "Consumer" c
SET "houseNumber" = c."houseNumber" || '-' || SUBSTRING(c."id"::text, 1, 6)
WHERE c.id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY "gpId", "houseNumber" ORDER BY "createdAt" ASC) as rn
        FROM "Consumer"
    ) sub
    WHERE sub.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Consumer_gpId_houseNumber_key" ON "Consumer"("gpId", "houseNumber");
