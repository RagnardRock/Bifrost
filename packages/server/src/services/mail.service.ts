/**
 * Envoi d'e-mails. Sans SMTP_URL (essais en local), le message est écrit dans la console du serveur.
 */
import nodemailer from 'nodemailer'
import { config } from '../config'
import { logger } from '../utils/logger'

const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null

export const mailActif = () => !!transport

export async function envoyer(a: string, sujet: string, texte: string, options: { repondreA?: string } = {}) {
  if (!transport) {
    logger.info(`[e-mail non envoyé, SMTP_URL absent] À : ${a} | ${sujet}\n${texte}`)
    return false
  }
  await transport.sendMail({ from: config.mailFrom, to: a, subject: sujet, text: texte, replyTo: options.repondreA })
  return true
}
