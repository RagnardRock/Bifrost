-- Adresses de réception des messages (vide = les responsables du site)
ALTER TABLE "sites" ADD COLUMN "email_messages" TEXT;

-- Messages reçus par les formulaires des sites (data-bf-formulaire)
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "formulaire" TEXT NOT NULL,
    "champs" JSONB NOT NULL,
    "email" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_site_id_created_at_idx" ON "messages"("site_id", "created_at");

ALTER TABLE "messages" ADD CONSTRAINT "messages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
