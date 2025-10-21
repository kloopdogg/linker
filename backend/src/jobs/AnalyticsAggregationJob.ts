import mongoose from 'mongoose';
import { Visit, Analytics, Url } from '../models/index';

/**
 * Analytics Aggregation Job
 * Aggregates visit data from previous days into the Analytics table for faster reporting
 */
class AnalyticsAggregationJob {
  /**
   * Main entry point - aggregate all pending days
   */
  static async run(): Promise<void> {
    const startTime = Date.now();
    console.log('[AnalyticsAggregation] Starting aggregation job...');

    try {
      // Find the date range to aggregate
      const daysAggregated = await this.aggregatePendingDays();
      
      const duration = Date.now() - startTime;
      console.log(`[AnalyticsAggregation] Completed in ${duration}ms. Aggregated ${daysAggregated} days.`);
    } catch (error) {
      console.error('[AnalyticsAggregation] Job failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate all days before today that haven't been aggregated yet
   */
  private static async aggregatePendingDays(): Promise<number> {
    // Get the start of today (in UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find the earliest visit date
    const firstVisit = await Visit.findOne().sort({ visitedAt: 1 }).select('visitedAt');
    if (!firstVisit) {
      console.log('[AnalyticsAggregation] No visits found, nothing to aggregate');
      return 0;
    }

    const firstDate = new Date(firstVisit.visitedAt);
    firstDate.setUTCHours(0, 0, 0, 0);

    let daysAggregated = 0;
    let currentDate = new Date(firstDate);

    // Aggregate each day up to (but not including) today
    while (currentDate < today) {
      const nextDate = new Date(currentDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);

      // Check if this day already has aggregated data
      const existingDaily = await Analytics.findOne({
        period: 'daily',
        date: currentDate,
        url: null // Check global analytics first
      });

      if (!existingDaily) {
        await this.aggregateDay(currentDate);
        daysAggregated++;
      }

      currentDate = nextDate;
    }

    return daysAggregated;
  }

  /**
   * Aggregate visits for a specific day
   */
  private static async aggregateDay(date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log(`[AnalyticsAggregation] Aggregating ${startOfDay.toISOString().split('T')[0]}`);

    // Get all URLs that have visits on this day
    const urlsWithVisits = await Visit.distinct('url', {
      visitedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Aggregate global analytics (url: null)
    await this.aggregateForUrl(null, startOfDay, endOfDay);

    // Aggregate per-URL analytics
    for (const urlId of urlsWithVisits) {
      await this.aggregateForUrl(urlId, startOfDay, endOfDay);
    }
  }

  /**
   * Aggregate visits for a specific URL (or global if urlId is null)
   */
  private static async aggregateForUrl(
    urlId: mongoose.Types.ObjectId | null,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<void> {
    const matchCondition: any = {
      visitedAt: { $gte: startOfDay, $lte: endOfDay }
    };

    if (urlId) {
      matchCondition.url = urlId;
    }

    // Run aggregation pipeline
    const [basicStats, countryStats, deviceStats, browserStats, hourlyStats, referrerStats] = await Promise.all([
      // Basic stats
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        }
      ]),

      // Country breakdown
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$country',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } }
      ]),

      // Device breakdown
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$device.type',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } }
      ]),

      // Browser breakdown
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$browser.name',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } }
      ]),

      // Hourly breakdown
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$hour',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Referrer breakdown (extract domain from referer)
      Visit.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$referer',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } },
        { $limit: 20 }
      ])
    ]);

    if (!basicStats.length || basicStats[0].totalVisits === 0) {
      // No data for this URL/day combination
      return;
    }

    // Format the data
    const analyticsDoc = {
      url: urlId,
      period: 'daily' as const,
      date: startOfDay,
      totalVisits: basicStats[0].totalVisits,
      uniqueVisits: basicStats[0].uniqueVisits,
      countries: countryStats.map((stat: any) => ({
        country: stat._id || 'Unknown',
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      devices: deviceStats.map((stat: any) => ({
        type: stat._id || 'unknown',
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      browsers: browserStats.map((stat: any) => ({
        name: stat._id || 'Unknown',
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      hourlyBreakdown: hourlyStats.map((stat: any) => ({
        hour: stat._id,
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      referrers: referrerStats.map((stat: any) => ({
        domain: this.extractDomain(stat._id),
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      }))
    };

    // Upsert the analytics document
    await Analytics.findOneAndUpdate(
      {
        url: urlId,
        period: 'daily',
        date: startOfDay
      },
      analyticsDoc,
      {
        upsert: true,
        new: true
      }
    );
  }

  /**
   * Extract domain from referrer URL
   */
  private static extractDomain(referer: string): string {
    if (!referer || referer === 'direct') {
      return 'direct';
    }

    try {
      const url = new URL(referer);
      return url.hostname;
    } catch {
      return referer;
    }
  }
}

export default AnalyticsAggregationJob;
