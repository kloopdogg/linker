import cron from 'node-cron';
import AnalyticsAggregationJob from './AnalyticsAggregationJob';

/**
 * Job Scheduler
 * Manages all scheduled background jobs
 */
class JobScheduler {
  private static jobs: ReturnType<typeof cron.schedule>[] = [];

  /**
   * Initialize and start all scheduled jobs
   */
  static start(): void {
    console.log('[JobScheduler] Starting scheduled jobs...');

    // Analytics Aggregation Job - runs every 1 hour
    // Cron format: minute hour day month dayOfWeek
    // */1 means "every 1 hour"
    const analyticsJob = cron.schedule('0 */1 * * *', async () => {
      console.log('[JobScheduler] Running Analytics Aggregation Job');
      try {
        await AnalyticsAggregationJob.run();
      } catch (error) {
        console.error('[JobScheduler] Analytics Aggregation Job failed:', error);
      }
    });

    this.jobs.push(analyticsJob);

    console.log('[JobScheduler] Scheduled jobs:');
    console.log('  - Analytics Aggregation: Every 1 hour (0 */1 * * *)');

    // Optional: Run once on startup to catch up on any missed aggregations
    this.runStartupAggregation();
  }

  /**
   * Stop all scheduled jobs
   */
  static stop(): void {
    console.log('[JobScheduler] Stopping all scheduled jobs...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
  }

  /**
   * Run analytics aggregation on startup (optional)
   * This ensures any missed days are aggregated when the server starts
   */
  private static async runStartupAggregation(): Promise<void> {
    console.log('[JobScheduler] Running startup analytics aggregation...');
    try {
      await AnalyticsAggregationJob.run();
    } catch (error) {
      console.error('[JobScheduler] Startup aggregation failed:', error);
    }
  }

  /**
   * Manually trigger analytics aggregation (useful for testing/admin)
   */
  static async triggerAnalyticsAggregation(): Promise<void> {
    console.log('[JobScheduler] Manually triggering analytics aggregation...');
    await AnalyticsAggregationJob.run();
  }
}

export default JobScheduler;
