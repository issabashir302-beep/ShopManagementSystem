import cron from 'node-cron'
export function startScheduler({ expression, timezone, monthlyReportJob, logger }) {
  if (!cron.validate(expression))
    throw new Error('MONTHLY_REPORT_CRON must be a valid cron expression')
  const task = cron.schedule(
    expression,
    () => monthlyReportJob().catch((error) => logger.error('monthly_report_job_failed', { error })),
    { timezone }
  )
  logger.info('scheduler_started', { monthlyReportCron: expression, timezone })
  return task
}
