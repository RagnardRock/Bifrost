-- Fiches clients (espace dev) et contrat
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact_nom" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "formule" TEXT,
    "prix" INTEGER,
    "periode" TEXT,
    "debut" TIMESTAMP(3),
    "echeance" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- Un site appartient (ou non) à un client, et peut être mis en pause
ALTER TABLE "sites" ADD COLUMN "client_id" TEXT;
ALTER TABLE "sites" ADD COLUMN "en_pause" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sites_client_id_idx" ON "sites"("client_id");
