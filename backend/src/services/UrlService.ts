import { Url, Visit, Counter } from '../models/index';
import QRCodeService from './QRCodeService';
import AnalyticsService from './AnalyticsService';
import { formatShortCodeFromValue, MAX_SHORT_CODE_VALUE } from '../models/Url';

const SHORT_CODE_COUNTER_KEY = 'shortCode';
const SHORT_CODE_GENERATION_ATTEMPTS = 10;

export interface CreateUrlData {
  originalUrl: string;
  title: string;
  description?: string;
  isActive?: boolean;
  expiresAt?: Date;
  tags?: string[];
  qrCustomization?: {
    size?: number;
    foregroundColor?: string;
    backgroundColor?: string;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };
}

export interface UrlFilters {
  isActive?: boolean;
  search?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface UrlPagination {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class UrlService {
  private static async getNextShortCodeValue(): Promise<number> {
    const counter = await Counter.findOneAndUpdate(
      { key: SHORT_CODE_COUNTER_KEY },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!counter) {
      throw new Error('Failed to access short code counter');
    }

    if (counter.value === 1) {
      const maxExisting = await Url.findOne()
        .sort({ shortCodeValue: -1 })
        .select('shortCodeValue')
        .lean();

      const maxValue = typeof maxExisting?.shortCodeValue === 'number' ? maxExisting.shortCodeValue : 0;

      if (maxValue >= counter.value) {
        const adjustedValue = maxValue + 1;
        const adjustedCounter = await Counter.findOneAndUpdate(
          { key: SHORT_CODE_COUNTER_KEY },
          { $set: { value: adjustedValue } },
          { new: true }
        );

        return adjustedCounter?.value ?? adjustedValue;
      }
    }

    return counter.value;
  }

  private static async generateShortCode(): Promise<{ shortCode: string; shortCodeValue: number }> {
    let attempts = 0;

    while (attempts < SHORT_CODE_GENERATION_ATTEMPTS) {
      const shortCodeValue = await this.getNextShortCodeValue();

      if (shortCodeValue > MAX_SHORT_CODE_VALUE) {
        throw new Error('Short code capacity exhausted');
      }

      const existing = await Url.findOne({ shortCodeValue }).select('_id').lean();

      if (!existing) {
        return {
          shortCodeValue,
          shortCode: formatShortCodeFromValue(shortCodeValue)
        };
      }

      attempts++;
    }

    throw new Error('Failed to generate unique short code');
  }

  static async createShortUrl(urlData: CreateUrlData, userId: string) {
    try {
      // Validate the original URL
      if (!this.isValidUrl(urlData.originalUrl)) {
        throw new Error('Invalid URL provided');
      }

      const { shortCode, shortCodeValue } = await this.generateShortCode();

      // Create the short URL
      const shortUrl = `${process.env.BASE_URL}/${shortCode}`;

      // Generate QR code
      const qrCodeData = await QRCodeService.generateQRCode(
        shortUrl, 
        urlData.qrCustomization || {}
      );

      // Create URL document
      const url = new Url({
        shortCode,
        shortCodeValue,
        originalUrl: urlData.originalUrl,
        title: urlData.title,
        description: urlData.description,
        qrCode: qrCodeData,
        isActive: urlData.isActive !== undefined ? urlData.isActive : true,
        expiresAt: urlData.expiresAt,
        tags: urlData.tags || [],
        createdBy: userId
      });

      await url.save();
      return url;
    } catch (error) {
      throw new Error(`Failed to create short URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getUrls(userId: string, filters: UrlFilters = {}, pagination: UrlPagination = {}) {
    try {
      const query: any = { createdBy: userId };

      // Apply filters
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { originalUrl: { $regex: filters.search, $options: 'i' } },
          { shortCode: { $regex: filters.search, $options: 'i' } }
        ];
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      // Pagination
      const page = parseInt(pagination.page as string) || 1;
      const limit = parseInt(pagination.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Sort
      const sort: any = pagination.sortBy ? 
        { [pagination.sortBy]: pagination.sortOrder === 'desc' ? -1 : 1 } :
        { createdAt: -1 };

      const [urls, total] = await Promise.all([
        Url.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .lean(),
        Url.countDocuments(query)
      ]);

      return {
        urls,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to get URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getUrlByShortCode(shortCode: string) {
    try {
      const url = await Url.findOne({ shortCode, isActive: true });
      return url;
    } catch (error) {
      throw new Error(`Failed to get URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getUrlById(urlId: string, userId: string) {
    try {
      const url = await Url.findOne({ 
        _id: urlId, 
        createdBy: userId 
      }).populate('createdBy', 'name email');

      if (!url) {
        throw new Error('URL not found');
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to retrieve URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async incrementVisitCount(urlId: string) {
    try {
      await Url.findByIdAndUpdate(
        urlId,
        { 
          $inc: { visitCount: 1 },
          lastVisited: new Date()
        }
      );
    } catch (error) {
      throw new Error(`Failed to increment visit count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return /^https?:\/\/.+/.test(string);
    } catch (_) {
      return false;
    }
  }

  static async deleteUrl(urlId: string, userId: string) {
    try {
      const url = await Url.findOneAndDelete({ 
        _id: urlId, 
        createdBy: userId 
      });
      
      if (!url) {
        throw new Error('URL not found or access denied');
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async updateUrl(urlId: string, userId: string, updateData: Partial<CreateUrlData>) {
    try {
      const url = await Url.findOneAndUpdate(
        { _id: urlId, createdBy: userId },
        updateData,
        { new: true }
      );

      if (!url) {
        throw new Error('URL not found or access denied');
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to update URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async handleRedirect(shortCode: string, req: any, visitorId?: string): Promise<string | null> {
    try {
      const url = await Url.findOne({ 
        shortCode, 
        isActive: true 
      });

      if (!url) {
        return null;
      }

      // Check if URL is expired
      if (url.expiresAt && url.expiresAt < new Date()) {
        return null;
      }

      // Track the visit
      await this.trackVisit(url, req, visitorId);

      return url.originalUrl;
    } catch (error) {
      console.error('Redirect error:', error);
      return null;
    }
  }

  static async trackVisit(url: any, req: any, visitorId?: string): Promise<void> {
    try {
      // Get analytics data
      const ipAddress = AnalyticsService.getClientIP(req);
      const userAgentString = req.headers['user-agent'] || 'unknown';
      const referrer = AnalyticsService.formatReferrer(req.headers.referer);
      
      // Parse user agent and get location
      const { browser, device } = AnalyticsService.parseUserAgent(userAgentString);
      const location = AnalyticsService.getLocationFromIP(ipAddress);
      
    // Generate session ID
    const sessionId = AnalyticsService.generateSessionId(req, visitorId);
      
      // Check if this is a unique visitor
      const isUniqueVisitor = await AnalyticsService.isUniqueVisitor(
        sessionId,
        url._id.toString(),
        visitorId
      );

      // Extract time components
      const timeComponents = AnalyticsService.extractTimeComponents();

      // Create visit record
      const visit = new Visit({
        url: url._id,
        shortCode: url.shortCode,
        ipAddress,
        userAgent: userAgentString,
        referer: referrer,
        country: location.country,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
    device,
    browser,
    visitorId,
        sessionId,
        isUniqueVisitor,
        hour: timeComponents.hour,
        dayOfWeek: timeComponents.dayOfWeek,
        dayOfMonth: timeComponents.dayOfMonth,
        month: timeComponents.month,
        year: timeComponents.year
      });

      await visit.save();

      // Update URL analytics
      await this.updateUrlAnalytics(url._id.toString(), isUniqueVisitor);

    } catch (error) {
      console.error('Visit tracking error:', error);
      // Don't throw error here to avoid breaking redirects
    }
  }

  static async updateUrlAnalytics(urlId: string, isUniqueVisitor: boolean): Promise<void> {
    try {
      const updateQuery: any = {
        $inc: { 
          visitCount: 1
        },
        $set: { lastVisited: new Date() }
      };

      if (isUniqueVisitor) {
        updateQuery.$inc.uniqueVisitCount = 1;
      }

      await Url.findByIdAndUpdate(urlId, updateQuery);
    } catch (error) {
      console.error('Analytics update error:', error);
    }
  }
}

export default UrlService;