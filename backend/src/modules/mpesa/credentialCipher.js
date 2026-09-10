import crypto from 'node:crypto'
import { AppError } from '../../errors/AppError.js'

function keyFrom(value) {
  if (!value) throw new AppError(503, 'MPESA_ENCRYPTION_UNAVAILABLE', 'M-Pesa credential encryption is not configured')
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64')
  if (key.length !== 32) throw new AppError(503, 'MPESA_ENCRYPTION_UNAVAILABLE', 'M-Pesa credential encryption key is invalid')
  return key
}

export function createCredentialCipher(keyValue) {
  return {
    encrypt(value) {
      if (!value) return null
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(keyValue), iv)
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
    },
    decrypt(value) {
      if (!value) return null
      const [version, iv, tag, encrypted] = value.split('.')
      if (version !== 'v1' || !iv || !tag || !encrypted) throw new AppError(500, 'MPESA_CREDENTIALS_INVALID', 'Stored M-Pesa credentials cannot be decrypted')
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(keyValue), Buffer.from(iv, 'base64'))
        decipher.setAuthTag(Buffer.from(tag, 'base64'))
        return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')
      } catch {
        throw new AppError(500, 'MPESA_CREDENTIALS_INVALID', 'Stored M-Pesa credentials cannot be decrypted')
      }
    }
  }
}
