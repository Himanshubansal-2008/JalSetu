/*
  Warnings:

  - You are about to drop the column `amount` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `Consumer` table. All the data in the column will be lost.
  - You are about to drop the column `houseNo` on the `Consumer` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyCharge` on the `Consumer` table. All the data in the column will be lost.
  - Added the required column `amountPaise` to the `Bill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `houseNumber` to the `Consumer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthlyChargePaise` to the `Consumer` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `Consumer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "amount",
ADD COLUMN     "amountPaise" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Consumer" DROP COLUMN "active",
DROP COLUMN "houseNo",
DROP COLUMN "monthlyCharge",
ADD COLUMN     "houseNumber" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monthlyChargePaise" INTEGER NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;
