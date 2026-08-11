import dotenv from 'dotenv'
import { IANAZone } from 'luxon'
import cron from 'node-cron'

dotenv.config({ quiet: true })

const VALID_ENVIRONMENTS = new Set(['development', 'test', 'production'])
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])

function required(name, source) {
  const value = source[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function validUrl(name, source) {
  const value = required(name, source)
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.toString().replace(/\/$/, '')
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`)
  }
}

export function parseEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV?.trim() || 'development'
  if (!VALID_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  const port = Number(source.PORT || 5000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const corsOrigins = required('CORS_ORIGINS', source)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)

  if (corsOrigins.length === 0) throw new Error('CORS_ORIGINS must contain at least one origin')
  if (nodeEnv === 'production' && corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS cannot contain * in production')
  }

  for (const origin of corsOrigins) {
    if (origin === '*' && nodeEnv !== 'production') continue
    try {
      const parsed = new URL(origin)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`)
    }
  }

  const logLevel = source.LOG_LEVEL?.trim() || 'info'
  if (!VALID_LOG_LEVELS.has(logLevel)) {
    throw new Error('LOG_LEVEL must be debug, info, warn, or error')
  }

  const appTimezone = source.APP_TIMEZONE?.trim() || 'UTC'
  if (!IANAZone.isValidZone(appTimezone)) throw new Error('APP_TIMEZONE must be a valid IANA timezone')
  const monthlyReportCron = source.MONTHLY_REPORT_CRON?.trim() || '0 8 1 * *'
  if (!cron.validate(monthlyReportCron)) throw new Error('MONTHLY_REPORT_CRON must be a valid cron expression')

  return Object.freeze({
    nodeEnv,
    port,
    supabaseUrl: validUrl('SUPABASE_URL', source),
    supabaseAnonKey: required('SUPABASE_ANON_KEY', source),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', source),
    stripeSecretKey: required('STRIPE_SECRET_KEY', source),
    stripeWebhookSecret: required('STRIPE_WEBHOOK_SECRET', source),
    resendApiKey: required('RESEND_API_KEY', source),
    resendFromEmail: required('RESEND_FROM_EMAIL', source),
    appTimezone, monthlyReportCron,
    corsOrigins: Object.freeze(corsOrigins),
    logLevel
  })
}

export const env = parseEnv()
