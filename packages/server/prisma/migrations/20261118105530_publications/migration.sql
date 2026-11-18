-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "auteur" TEXT,
    "ajoutes" JSONB NOT NULL,
    "modifies" JSONB NOT NULL,
    "supprimes" JSONB NOT NULL,
    "annulee" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publications_site_id_created_at_idx" ON "publications"("site_id", "created_at");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
