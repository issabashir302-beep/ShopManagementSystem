export const createMonthlyReportJob = (notificationService, logger) => async () => {
  logger.info('monthly_report_job_started')
  const result = await notificationService.runMonthly()
  logger.info('monthly_report_job_finished', { reportMonth: result.period })
}
