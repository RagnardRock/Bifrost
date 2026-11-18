/**
 * Crée (ou remet le mot de passe d'un) compte dev pour l'espace développeur.
 *
 *   npm run admin:creer -w @bifrost/server -- <email> <mot-de-passe>
 */
import { prisma } from '../src/config/database'
import { hashPassword } from '../src/utils/hash'

async function main() {
  const [email, motDePasse] = process.argv.slice(2)
  if (!email || !motDePasse || motDePasse.length < 10) {
    console.error('Usage : creer-admin <email> <mot-de-passe de 10 caractères minimum>')
    process.exit(1)
  }
  const passwordHash = await hashPassword(motDePasse)
  await prisma.admin.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } })
  console.log(`Compte dev prêt : ${email}`)
  console.log('Espace développeur : http://localhost:5173/admin/login')
}

main().finally(() => prisma.$disconnect())
