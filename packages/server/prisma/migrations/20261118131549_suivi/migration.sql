-- CreateTable
CREATE TABLE "evenements" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "auteur" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evenements_site_id_created_at_idx" ON "evenements"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "evenements_created_at_idx" ON "evenements"("created_at");

-- AddForeignKey
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
