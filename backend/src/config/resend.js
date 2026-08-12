import { Resend } from 'resend'
export function createResendClient(apiKey) {
  const resend = new Resend(apiKey)
  return {
    async send(message, idempotencyKey) {
      return resend.emails.send(message, { idempotencyKey })
    }
  }
}
