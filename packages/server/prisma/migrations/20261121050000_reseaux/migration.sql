-- CreateTable
CREATE TABLE "comptes_reseaux" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reseau" TEXT NOT NULL DEFAULT 'instagram',
    "compte_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "jeton" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "collection" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'brouillon',
    "depuis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniere_verif" TIMESTAMP(3),
    "erreur" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comptes_reseaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts_importes" (
    "id" TEXT NOT NULL,
    "compte_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_importes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comptes_reseaux_site_id_reseau_key" ON "comptes_reseaux"("site_id", "reseau");

-- CreateIndex
CREATE UNIQUE INDEX "posts_importes_compte_id_post_id_key" ON "posts_importes"("compte_id", "post_id");

-- AddForeignKey
ALTER TABLE "comptes_reseaux" ADD CONSTRAINT "comptes_reseaux_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_importes" ADD CONSTRAINT "posts_importes_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "comptes_reseaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

