-- CreateTable
CREATE TABLE "CustomTable" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomTable_tableName_key" ON "CustomTable"("tableName");
