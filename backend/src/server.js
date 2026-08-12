import { env } from './config/env.js'
import { buildDependencies } from './dependencies.js'
import { createApp } from './app.js'
import { startScheduler } from './jobs/scheduler.js'

const dependencies = buildDependencies(env)
const app = createApp({ config: env, ...dependencies })
const server = app.listen(env.port, () => {
  dependencies.logger.info('server_started', {
    port: env.port,
    environment: env.nodeEnv
  })
})
const scheduler = startScheduler({
  expression: env.monthlyReportCron,
  timezone: env.appTimezone,
  monthlyReportJob: dependencies.monthlyReportJob,
  logger: dependencies.logger
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  scheduler.stop()
  dependencies.logger.info('server_shutdown_started', { signal })

  server.close((error) => {
    if (error) {
      dependencies.logger.error('server_shutdown_failed', { error })
      process.exitCode = 1
    }
    process.exit()
  })

  setTimeout(() => {
    dependencies.logger.error('server_shutdown_timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (error) => {
  dependencies.logger.error('unhandled_rejection', {
    error: error instanceof Error ? error : new Error(String(error))
  })
})

process.on('uncaughtException', (error) => {
  dependencies.logger.error('uncaught_exception', { error })
  shutdown('uncaughtException')
})
