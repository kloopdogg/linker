import { Visit, Url, Analytics } from '../models/index';
import mongoose from 'mongoose';

export interface DateRange {
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days';
}

export interface OverviewStats {
  totalVisits: number;
  uniqueVisitors: number;
  topCountries: CountryStat[];
  deviceBreakdown: DeviceStat[];
  dailyStats: DailyStat[];
}

export interface CountryStat {
  country: string;
  visits: number;
  uniqueVisits: number;
  percentage?: string;
}

export interface DeviceStat {
  device?: string;
  type?: string;
  name?: string;
  visits: number;
  uniqueVisits: number;
  percentage?: string;
}

export interface MobileDeviceStat {
  brand: string;
  visits: number;
  uniqueVisits: number;
  percentage?: string;
}

export interface DeviceTypeStat {
  type: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  visits: number;
  uniqueVisits: number;
  percentage?: string;
}

export interface DailyStat {
  date: Date;
  visits: number;
  uniqueVisits: number;
}

export interface DeviceAnalytics {
  devices: DeviceStat[];
  browsers: DeviceStat[];
}

export interface TimePatternAnalytics {
  hourlyPatterns: HourlyPattern[];
  dailyPatterns: DailyPattern[];
}

export interface HourlyPattern {
  hour: number;
  visits: number;
  uniqueVisits: number;
}

export interface DailyPattern {
  day: number;
  dayName: string;
  visits: number;
  uniqueVisits: number;
}

export interface UrlSpecificAnalytics {
  url: {
    id: string;
    shortCode: string;
    title: string;
    originalUrl: string;
    createdAt: Date;
  };
  stats: {
    totalVisits: number;
    uniqueVisits: number;
  };
  countries: CountryStat[];
  devices: DeviceStat[];
  mobileDevices: MobileDeviceStat[];
  timeline: DailyStat[];
}

class AnalyticsReportService {
  /**
   * Get the start of today in UTC
   */
  private static getStartOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Check if a date is today
   */
  private static isToday(date: Date): boolean {
    const today = this.getStartOfToday();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return date >= today && date < tomorrow;
  }

  static async getOverviewStats(userId: string, dateRange: DateRange = {}): Promise<OverviewStats> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      // Get user's URLs
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const today = this.getStartOfToday();
      
      // Determine if we need to split the query between aggregated and real-time data
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      let historicalStats: any = null;
      let currentStats: any = null;

      // Get historical data from Analytics table (aggregated)
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        historicalStats = await this.getHistoricalOverviewStats(urlIds, startDate, historicalEndDate);
      }

      // Get current day data from Visit table (real-time)
      if (includesCurrentData) {
        currentStats = await this.getCurrentDayOverviewStats(urlIds, today, endDate);
      }

      // Merge the results
      return this.mergeOverviewStats(historicalStats, currentStats, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get overview stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get historical stats from Analytics table
   */
  private static async getHistoricalOverviewStats(
    urlIds: any[],
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Query aggregated analytics data
    const analyticsData = await Analytics.find({
      url: { $in: [null, ...urlIds] }, // Include both global and per-URL analytics
      period: 'daily',
      date: { $gte: startDate, $lte: endDate }
    });

    // Aggregate the data
    let totalVisits = 0;
    let uniqueVisits = 0;
    const countryMap = new Map<string, { visits: number; uniqueVisits: number }>();
    const deviceMap = new Map<string, { visits: number; uniqueVisits: number }>();
    const dailyMap = new Map<string, { visits: number; uniqueVisits: number }>();

    for (const doc of analyticsData) {
      // Only count URL-specific analytics (not global)
      if (doc.url) {
        totalVisits += doc.totalVisits;
        uniqueVisits += doc.uniqueVisits;

        // Aggregate countries
        for (const country of doc.countries) {
          const existing = countryMap.get(country.country) || { visits: 0, uniqueVisits: 0 };
          countryMap.set(country.country, {
            visits: existing.visits + country.visits,
            uniqueVisits: existing.uniqueVisits + country.uniqueVisits
          });
        }

        // Aggregate devices
        for (const device of doc.devices) {
          const existing = deviceMap.get(device.type) || { visits: 0, uniqueVisits: 0 };
          deviceMap.set(device.type, {
            visits: existing.visits + device.visits,
            uniqueVisits: existing.uniqueVisits + device.uniqueVisits
          });
        }

        // Aggregate daily stats
        const dateKey = doc.date.toISOString().split('T')[0];
        const existing = dailyMap.get(dateKey) || { visits: 0, uniqueVisits: 0 };
        dailyMap.set(dateKey, {
          visits: existing.visits + doc.totalVisits,
          uniqueVisits: existing.uniqueVisits + doc.uniqueVisits
        });
      }
    }

    return {
      totalVisits,
      uniqueVisits,
      countries: Array.from(countryMap.entries()).map(([country, stats]) => ({
        country,
        ...stats
      })),
      devices: Array.from(deviceMap.entries()).map(([type, stats]) => ({
        device: type,
        ...stats
      })),
      dailyStats: Array.from(dailyMap.entries()).map(([dateStr, stats]) => ({
        date: new Date(dateStr),
        ...stats
      }))
    };
  }

  /**
   * Get current day stats from Visit table
   */
  private static async getCurrentDayOverviewStats(
    urlIds: any[],
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const pipeline = [
      {
        $match: {
          url: { $in: urlIds },
          visitedAt: { $gte: startDate, $lte: endDate }
        }
      }
    ];

    const [totalStats, uniqueStats, countryStats, deviceStats, timeStats] = await Promise.all([
      Visit.aggregate([...pipeline, { $count: 'totalVisits' }]),
      Visit.aggregate([...pipeline, { $match: { isUniqueVisitor: true } }, { $count: 'uniqueVisitors' }]),
      Visit.aggregate([
        ...pipeline,
        {
          $group: {
            _id: '$country',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } }
      ]),
      Visit.aggregate([
        ...pipeline,
        {
          $group: {
            _id: '$device.type',
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { visits: -1 } }
      ]),
      Visit.aggregate([
        ...pipeline,
        {
          $group: {
            _id: {
              year: { $year: '$visitedAt' },
              month: { $month: '$visitedAt' },
              day: { $dayOfMonth: '$visitedAt' }
            },
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    return {
      totalVisits: totalStats[0]?.totalVisits || 0,
      uniqueVisits: uniqueStats[0]?.uniqueVisitors || 0,
      countries: countryStats.map((stat: any) => ({
        country: stat._id || 'Unknown',
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      devices: deviceStats.map((stat: any) => ({
        device: stat._id || 'unknown',
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      })),
      dailyStats: timeStats.map((stat: any) => ({
        date: new Date(stat._id.year, stat._id.month - 1, stat._id.day),
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits
      }))
    };
  }

  /**
   * Merge historical and current stats
   */
  private static mergeOverviewStats(
    historical: any,
    current: any,
    startDate: Date,
    endDate: Date
  ): OverviewStats {
    const merged = {
      totalVisits: (historical?.totalVisits || 0) + (current?.totalVisits || 0),
      uniqueVisitors: (historical?.uniqueVisits || 0) + (current?.uniqueVisits || 0),
      topCountries: [] as CountryStat[],
      deviceBreakdown: [] as DeviceStat[],
      dailyStats: [] as DailyStat[]
    };

    // Merge countries
    const countryMap = new Map<string, { visits: number; uniqueVisits: number }>();
    [...(historical?.countries || []), ...(current?.countries || [])].forEach((stat: any) => {
      const existing = countryMap.get(stat.country) || { visits: 0, uniqueVisits: 0 };
      countryMap.set(stat.country, {
        visits: existing.visits + stat.visits,
        uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
      });
    });
    merged.topCountries = Array.from(countryMap.entries())
      .map(([country, stats]) => ({ country, ...stats }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    // Merge devices
    const deviceMap = new Map<string, { visits: number; uniqueVisits: number }>();
    [...(historical?.devices || []), ...(current?.devices || [])].forEach((stat: any) => {
      const key = stat.device || stat.type || 'unknown';
      const existing = deviceMap.get(key) || { visits: 0, uniqueVisits: 0 };
      deviceMap.set(key, {
        visits: existing.visits + stat.visits,
        uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
      });
    });
    merged.deviceBreakdown = Array.from(deviceMap.entries())
      .map(([device, stats]) => ({ device, ...stats }))
      .sort((a, b) => b.visits - a.visits);

    // Merge daily stats
    const dailyMap = new Map<string, { visits: number; uniqueVisits: number }>();
    [...(historical?.dailyStats || []), ...(current?.dailyStats || [])].forEach((stat: any) => {
      const dateKey = new Date(stat.date).toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { visits: 0, uniqueVisits: 0 };
      dailyMap.set(dateKey, {
        visits: existing.visits + stat.visits,
        uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
      });
    });
    merged.dailyStats = Array.from(dailyMap.entries())
      .map(([dateStr, stats]) => ({
        date: new Date(dateStr),
        ...stats
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return merged;
  }

  static async getCountryAnalytics(userId: string, dateRange: DateRange = {}): Promise<CountryStat[]> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const today = this.getStartOfToday();
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      const countryMap = new Map<string, { visits: number; uniqueVisits: number }>();

      // Get historical data from Analytics table
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        const analyticsData = await Analytics.find({
          url: { $in: urlIds },
          period: 'daily',
          date: { $gte: startDate, $lte: historicalEndDate }
        });

        for (const doc of analyticsData) {
          for (const country of doc.countries) {
            const existing = countryMap.get(country.country) || { visits: 0, uniqueVisits: 0 };
            countryMap.set(country.country, {
              visits: existing.visits + country.visits,
              uniqueVisits: existing.uniqueVisits + country.uniqueVisits
            });
          }
        }
      }

      // Get current day data from Visit table
      if (includesCurrentData) {
        const currentStats = await Visit.aggregate([
          {
            $match: {
              url: { $in: urlIds },
              visitedAt: { $gte: today, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$country',
              visits: { $sum: 1 },
              uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
            }
          }
        ]);

        for (const stat of currentStats) {
          const country = stat._id || 'Unknown';
          const existing = countryMap.get(country) || { visits: 0, uniqueVisits: 0 };
          countryMap.set(country, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }
      }

      const countryStats = Array.from(countryMap.entries())
        .map(([country, stats]) => ({ country, ...stats }))
        .sort((a, b) => b.visits - a.visits);

      const totalVisits = countryStats.reduce((sum: number, stat: any) => sum + stat.visits, 0);

      return countryStats.map((stat: any) => ({
        country: stat.country,
        visits: stat.visits,
        uniqueVisits: stat.uniqueVisits,
        percentage: totalVisits > 0 ? ((stat.visits / totalVisits) * 100).toFixed(2) : '0'
      }));
    } catch (error) {
      throw new Error(`Failed to get country analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getDeviceAnalytics(userId: string, dateRange: DateRange = {}): Promise<DeviceAnalytics> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const today = this.getStartOfToday();
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      const deviceMap = new Map<string, { visits: number; uniqueVisits: number }>();
      const browserMap = new Map<string, { visits: number; uniqueVisits: number }>();

      // Get historical data from Analytics table
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        const analyticsData = await Analytics.find({
          url: { $in: urlIds },
          period: 'daily',
          date: { $gte: startDate, $lte: historicalEndDate }
        });

        for (const doc of analyticsData) {
          // Aggregate devices
          for (const device of doc.devices) {
            const existing = deviceMap.get(device.type) || { visits: 0, uniqueVisits: 0 };
            deviceMap.set(device.type, {
              visits: existing.visits + device.visits,
              uniqueVisits: existing.uniqueVisits + device.uniqueVisits
            });
          }

          // Aggregate browsers
          for (const browser of doc.browsers) {
            const existing = browserMap.get(browser.name) || { visits: 0, uniqueVisits: 0 };
            browserMap.set(browser.name, {
              visits: existing.visits + browser.visits,
              uniqueVisits: existing.uniqueVisits + browser.uniqueVisits
            });
          }
        }
      }

      // Get current day data from Visit table
      if (includesCurrentData) {
        const [currentDeviceStats, currentBrowserStats] = await Promise.all([
          Visit.aggregate([
            {
              $match: {
                url: { $in: urlIds },
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$device.type',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ]),
          Visit.aggregate([
            {
              $match: {
                url: { $in: urlIds },
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$browser.name',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ])
        ]);

        for (const stat of currentDeviceStats) {
          const type = stat._id || 'unknown';
          const existing = deviceMap.get(type) || { visits: 0, uniqueVisits: 0 };
          deviceMap.set(type, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }

        for (const stat of currentBrowserStats) {
          const name = stat._id || 'Unknown';
          const existing = browserMap.get(name) || { visits: 0, uniqueVisits: 0 };
          browserMap.set(name, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }
      }

      const deviceStats = Array.from(deviceMap.entries())
        .map(([type, stats]) => ({ type, ...stats }))
        .sort((a, b) => b.visits - a.visits);

      const browserStats = Array.from(browserMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10);

      const totalVisits = deviceStats.reduce((sum: number, stat: any) => sum + stat.visits, 0);

      return {
        devices: deviceStats.map((stat: any) => ({
          type: stat.type,
          visits: stat.visits,
          uniqueVisits: stat.uniqueVisits,
          percentage: totalVisits > 0 ? ((stat.visits / totalVisits) * 100).toFixed(2) : '0'
        })),
        browsers: browserStats.map((stat: any) => ({
          name: stat.name,
          visits: stat.visits,
          uniqueVisits: stat.uniqueVisits
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get device analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getDeviceTypeBreakdown(userId: string, dateRange: DateRange = {}): Promise<DeviceTypeStat[]> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const today = this.getStartOfToday();
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      const deviceTypeMap = new Map<string, { visits: number; uniqueVisits: number }>();

      // Get historical data from Analytics table
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        const analyticsData = await Analytics.find({
          url: { $in: urlIds },
          period: 'daily',
          date: { $gte: startDate, $lte: historicalEndDate }
        });

        for (const doc of analyticsData) {
          for (const device of doc.devices) {
            const existing = deviceTypeMap.get(device.type) || { visits: 0, uniqueVisits: 0 };
            deviceTypeMap.set(device.type, {
              visits: existing.visits + device.visits,
              uniqueVisits: existing.uniqueVisits + device.uniqueVisits
            });
          }
        }
      }

      // Get current day data from Visit table
      if (includesCurrentData) {
        const currentStats = await Visit.aggregate([
          {
            $match: {
              url: { $in: urlIds },
              visitedAt: { $gte: today, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$device.type',
              visits: { $sum: 1 },
              uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
            }
          }
        ]);

        for (const stat of currentStats) {
          const type = stat._id || 'unknown';
          const existing = deviceTypeMap.get(type) || { visits: 0, uniqueVisits: 0 };
          deviceTypeMap.set(type, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }
      }

      const stats = Array.from(deviceTypeMap.entries())
        .map(([type, data]) => ({ 
          type: type as 'mobile' | 'desktop' | 'tablet' | 'unknown', 
          ...data 
        }))
        .sort((a, b) => b.visits - a.visits);

      const totalVisits = stats.reduce((sum, stat) => sum + stat.visits, 0);

      return stats.map(stat => ({
        ...stat,
        percentage: totalVisits > 0 ? ((stat.visits / totalVisits) * 100).toFixed(2) : '0'
      }));
    } catch (error) {
      throw new Error(`Failed to get device type breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getMobileDeviceBreakdown(userId: string, dateRange: DateRange = {}): Promise<MobileDeviceStat[]> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const mobileDeviceMap = new Map<string, { visits: number; uniqueVisits: number }>();

      // Note: Historical data from Analytics table doesn't store brand info
      // We can only get mobile device breakdown from Visit table
      // Query all visits in the date range, not just today

      const stats = await Visit.aggregate([
        {
          $match: {
            url: { $in: urlIds },
            visitedAt: { $gte: startDate, $lte: endDate },
            'device.type': { $in: ['mobile', 'tablet'] }
          }
        },
        {
          $group: {
            _id: { $ifNull: ['$device.brand', 'Unknown'] },
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        },
        {
          $sort: { visits: -1 }
        }
      ]);

      for (const stat of stats) {
        const brand = stat._id || 'Unknown';
        mobileDeviceMap.set(brand, {
          visits: stat.visits,
          uniqueVisits: stat.uniqueVisits
        });
      }

      const result = Array.from(mobileDeviceMap.entries())
        .map(([brand, data]) => ({ brand, ...data }))
        .sort((a, b) => b.visits - a.visits);

      const totalVisits = result.reduce((sum, stat) => sum + stat.visits, 0);

      return result.map(stat => ({
        ...stat,
        percentage: totalVisits > 0 ? ((stat.visits / totalVisits) * 100).toFixed(2) : '0'
      }));
    } catch (error) {
      throw new Error(`Failed to get mobile device breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getTimePatternAnalytics(userId: string, dateRange: DateRange = {}): Promise<TimePatternAnalytics> {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);
      
      const userUrls = await Url.find({ createdBy: userId }).select('_id');
      const urlIds = userUrls.map(url => url._id);

      const today = this.getStartOfToday();
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      const hourlyMap = new Map<number, { visits: number; uniqueVisits: number }>();
      const dailyMap = new Map<number, { visits: number; uniqueVisits: number }>();

      // Get historical data from Analytics table
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        const analyticsData = await Analytics.find({
          url: { $in: urlIds },
          period: 'daily',
          date: { $gte: startDate, $lte: historicalEndDate }
        });

        for (const doc of analyticsData) {
          // Aggregate hourly breakdown
          for (const hourData of doc.hourlyBreakdown) {
            const existing = hourlyMap.get(hourData.hour) || { visits: 0, uniqueVisits: 0 };
            hourlyMap.set(hourData.hour, {
              visits: existing.visits + hourData.visits,
              uniqueVisits: existing.uniqueVisits + hourData.uniqueVisits
            });
          }

          // Calculate day of week from date for daily patterns
          const dayOfWeek = new Date(doc.date).getDay();
          const existing = dailyMap.get(dayOfWeek) || { visits: 0, uniqueVisits: 0 };
          dailyMap.set(dayOfWeek, {
            visits: existing.visits + doc.totalVisits,
            uniqueVisits: existing.uniqueVisits + doc.uniqueVisits
          });
        }
      }

      // Get current day data from Visit table
      if (includesCurrentData) {
        const [hourlyStats, dailyStats] = await Promise.all([
          Visit.aggregate([
            {
              $match: {
                url: { $in: urlIds },
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$hour',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ]),
          Visit.aggregate([
            {
              $match: {
                url: { $in: urlIds },
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$dayOfWeek',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ])
        ]);

        for (const stat of hourlyStats) {
          const existing = hourlyMap.get(stat._id) || { visits: 0, uniqueVisits: 0 };
          hourlyMap.set(stat._id, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }

        for (const stat of dailyStats) {
          const existing = dailyMap.get(stat._id) || { visits: 0, uniqueVisits: 0 };
          dailyMap.set(stat._id, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }
      }

      // Create complete hourly array (0-23)
      const hourlyData: HourlyPattern[] = Array.from({ length: 24 }, (_, hour) => {
        const stat = hourlyMap.get(hour);
        return {
          hour,
          visits: stat?.visits || 0,
          uniqueVisits: stat?.uniqueVisits || 0
        };
      });

      // Create complete daily array (0-6)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dailyData: DailyPattern[] = Array.from({ length: 7 }, (_, day) => {
        const stat = dailyMap.get(day);
        return {
          day,
          dayName: dayNames[day] || 'Unknown',
          visits: stat?.visits || 0,
          uniqueVisits: stat?.uniqueVisits || 0
        };
      });

      return {
        hourlyPatterns: hourlyData,
        dailyPatterns: dailyData
      };
    } catch (error) {
      throw new Error(`Failed to get time pattern analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getUrlSpecificAnalytics(urlId: string, userId: string, dateRange: DateRange = {}): Promise<UrlSpecificAnalytics> {
    try {
      // Verify URL belongs to user
      const url = await Url.findOne({ _id: urlId, createdBy: userId });
      if (!url) {
        throw new Error('URL not found or access denied');
      }

      const { startDate, endDate } = this.getDateRange(dateRange);
      const today = this.getStartOfToday();
      const includesHistoricalData = startDate < today;
      const includesCurrentData = endDate >= today;

      let totalVisits = 0;
      let uniqueVisits = 0;
      const countryMap = new Map<string, { visits: number; uniqueVisits: number }>();
      const deviceMap = new Map<string, { visits: number; uniqueVisits: number }>();
      const mobileDeviceMap = new Map<string, { visits: number; uniqueVisits: number }>();
      const timelineMap = new Map<string, { visits: number; uniqueVisits: number }>();

      // Get historical data from Analytics table
      if (includesHistoricalData) {
        const historicalEndDate = endDate < today ? endDate : new Date(today.getTime() - 1);
        const analyticsData = await Analytics.find({
          url: new mongoose.Types.ObjectId(urlId),
          period: 'daily',
          date: { $gte: startDate, $lte: historicalEndDate }
        });

        for (const doc of analyticsData) {
          totalVisits += doc.totalVisits;
          uniqueVisits += doc.uniqueVisits;

          // Aggregate countries
          for (const country of doc.countries) {
            const existing = countryMap.get(country.country) || { visits: 0, uniqueVisits: 0 };
            countryMap.set(country.country, {
              visits: existing.visits + country.visits,
              uniqueVisits: existing.uniqueVisits + country.uniqueVisits
            });
          }

          // Aggregate devices
          for (const device of doc.devices) {
            const existing = deviceMap.get(device.type) || { visits: 0, uniqueVisits: 0 };
            deviceMap.set(device.type, {
              visits: existing.visits + device.visits,
              uniqueVisits: existing.uniqueVisits + device.uniqueVisits
            });
          }

          // Timeline
          const dateKey = doc.date.toISOString().split('T')[0];
          timelineMap.set(dateKey, {
            visits: doc.totalVisits,
            uniqueVisits: doc.uniqueVisits
          });
        }
      }

      // Get current day data from Visit table
      if (includesCurrentData) {
        const [basicStats, countryStats, deviceStats, timelineStats] = await Promise.all([
          Visit.aggregate([
            {
              $match: {
                url: new mongoose.Types.ObjectId(urlId),
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                totalVisits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ]),
          Visit.aggregate([
            {
              $match: {
                url: new mongoose.Types.ObjectId(urlId),
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$country',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ]),
          Visit.aggregate([
            {
              $match: {
                url: new mongoose.Types.ObjectId(urlId),
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$device.type',
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ]),
          Visit.aggregate([
            {
              $match: {
                url: new mongoose.Types.ObjectId(urlId),
                visitedAt: { $gte: today, $lte: endDate }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$visitedAt' },
                  month: { $month: '$visitedAt' },
                  day: { $dayOfMonth: '$visitedAt' }
                },
                visits: { $sum: 1 },
                uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
              }
            }
          ])
        ]);

        totalVisits += basicStats[0]?.totalVisits || 0;
        uniqueVisits += basicStats[0]?.uniqueVisits || 0;

        for (const stat of countryStats) {
          const country = stat._id || 'Unknown';
          const existing = countryMap.get(country) || { visits: 0, uniqueVisits: 0 };
          countryMap.set(country, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }

        for (const stat of deviceStats) {
          const type = stat._id || 'unknown';
          const existing = deviceMap.get(type) || { visits: 0, uniqueVisits: 0 };
          deviceMap.set(type, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }

        for (const stat of timelineStats) {
          const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
          const dateKey = date.toISOString().split('T')[0];
          const existing = timelineMap.get(dateKey) || { visits: 0, uniqueVisits: 0 };
          timelineMap.set(dateKey, {
            visits: existing.visits + stat.visits,
            uniqueVisits: existing.uniqueVisits + stat.uniqueVisits
          });
        }
      }

      // Get mobile device data from Visit table for ENTIRE date range
      // (Analytics table doesn't store brand info)
      const mobileDeviceStats = await Visit.aggregate([
        {
          $match: {
            url: new mongoose.Types.ObjectId(urlId),
            visitedAt: { $gte: startDate, $lte: endDate },
            'device.type': { $in: ['mobile', 'tablet'] }
          }
        },
        {
          $group: {
            _id: { $ifNull: ['$device.brand', 'Unknown'] },
            visits: { $sum: 1 },
            uniqueVisits: { $sum: { $cond: ['$isUniqueVisitor', 1, 0] } }
          }
        }
      ]);

      for (const stat of mobileDeviceStats) {
        const brand = stat._id || 'Unknown';
        mobileDeviceMap.set(brand, {
          visits: stat.visits,
          uniqueVisits: stat.uniqueVisits
        });
      }

      return {
        url: {
          id: (url as any)._id.toString(),
          shortCode: url.shortCode,
          title: url.title,
          originalUrl: url.originalUrl,
          createdAt: url.createdAt
        },
        stats: {
          totalVisits,
          uniqueVisits
        },
        countries: Array.from(countryMap.entries())
          .map(([country, stats]) => ({ country, ...stats }))
          .sort((a, b) => b.visits - a.visits),
        devices: Array.from(deviceMap.entries())
          .map(([type, stats]) => ({ type, ...stats }))
          .sort((a, b) => b.visits - a.visits),
        mobileDevices: Array.from(mobileDeviceMap.entries())
          .map(([brand, stats]) => ({ brand, ...stats }))
          .sort((a, b) => b.visits - a.visits),
        timeline: Array.from(timelineMap.entries())
          .map(([dateStr, stats]) => ({
            date: new Date(dateStr),
            ...stats
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
      };
    } catch (error) {
      throw new Error(`Failed to get URL analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static getDateRange(dateRange: DateRange): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date, endDate: Date;

    if (dateRange.startDate && dateRange.endDate) {
      startDate = new Date(dateRange.startDate);
      endDate = new Date(dateRange.endDate);
    } else if (dateRange.period) {
      endDate = now;
      switch (dateRange.period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Default to last 30 days
      endDate = now;
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }
}

export default AnalyticsReportService;