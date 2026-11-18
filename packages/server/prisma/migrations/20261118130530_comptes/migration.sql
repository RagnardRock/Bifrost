-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'responsable';

-- CreateTable
CREATE TABLE "jetons" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'redacteur',
    "hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jetons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jetons_hash_key" ON "jetons"("hash");

-- CreateIndex
CREATE INDEX "jetons_site_id_type_idx" ON "jetons"("site_id", "type");

-- AddForeignKey
ALTER TABLE "jetons" ADD CONSTRAINT "jetons_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
