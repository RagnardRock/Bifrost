-- Nom court des sites dans leur adresse publique
ALTER TABLE "sites" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "sites_slug_key" ON "sites"("slug");
