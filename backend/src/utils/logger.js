const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

function safeError(error) {
  if (!error) return undefined
  return {
    name: error.name,
    message: error.message,
    ...(error.code ? { code: error.code } : {})
  }
}

export function createLogger({ level = 'info', output = process.stdout } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info

  function write(logLevel, message, context = {}) {
    if (LEVELS[logLevel] < threshold) return
    const entry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
      ...context
    }
    if (entry.error instanceof Error) entry.error = safeError(entry.error)
    output.write(`${JSON.stringify(entry)}\n`)
  }

  return Object.freeze({
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context)
  })
}
