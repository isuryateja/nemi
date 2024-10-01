/*
  Warnings:

  - You are about to drop the `CustomTable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CustomTable";

-- CreateTable
CREATE TABLE "NemiTables" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NemiTables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NemiTables_tableName_key" ON "NemiTables"("tableName");
