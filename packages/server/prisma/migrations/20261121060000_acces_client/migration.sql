-- AlterTable
ALTER TABLE "jetons" ADD COLUMN     "client_id" TEXT,
ALTER COLUMN "site_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "membres" ADD COLUMN     "par_client" TEXT;

-- CreateTable
CREATE TABLE "acces_clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'responsable',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acces_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acces_clients_client_id_user_id_key" ON "acces_clients"("client_id", "user_id");

-- AddForeignKey
ALTER TABLE "acces_clients" ADD CONSTRAINT "acces_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_clients" ADD CONSTRAINT "acces_clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons" ADD CONSTRAINT "jetons_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

