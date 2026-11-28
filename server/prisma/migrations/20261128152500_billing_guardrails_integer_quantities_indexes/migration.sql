-- AlterEnum
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'WAIVED';

-- AlterTable InventoryItem
ALTER TABLE "InventoryItem" ALTER COLUMN "quantity" SET DATA TYPE INTEGER USING ROUND("quantity")::INTEGER;
ALTER TABLE "InventoryItem" ALTER COLUMN "quantity" SET DEFAULT 0;
ALTER TABLE "InventoryItem" ALTER COLUMN "reorderLevel" SET DATA TYPE INTEGER USING ROUND("reorderLevel")::INTEGER;
ALTER TABLE "InventoryItem" ALTER COLUMN "reorderLevel" SET DEFAULT 0;

-- AlterTable StockTxn
ALTER TABLE "StockTxn" ALTER COLUMN "quantity" SET DATA TYPE INTEGER USING ROUND("quantity")::INTEGER;

-- AlterTable Bill
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

-- Create Indexes
CREATE INDEX IF NOT EXISTS "User_gpId_idx" ON "User"("gpId");
CREATE INDEX IF NOT EXISTS "StockTxn_itemId_idx" ON "StockTxn"("itemId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_assetId_idx" ON "LedgerEntry"("assetId");
CREATE INDEX IF NOT EXISTS "Bill_consumerId_idx" ON "Bill"("consumerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Bill_gpId_consumerId_month_key" ON "Bill"("gpId", "consumerId", "month");
