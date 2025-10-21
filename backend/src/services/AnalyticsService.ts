import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { isIP } from 'net';
import { Visit } from '../models/index';

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
}

export interface DeviceInfo {
  type: string;
  brand: string;
  os: {
    name: string;
    version: string;
  };
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  timezone: string;
}

export interface ParsedUserAgent {
  browser: BrowserInfo;
  device: DeviceInfo;
}

class AnalyticsService {
  static parseUserAgent(userAgentString: string): ParsedUserAgent {
    const parser = new UAParser();
    const result = parser.setUA(userAgentString).getResult();
    
    // Determine device type
    let deviceType: string = 'unknown';
    if (result.device.type) {
      deviceType = result.device.type;
    } else if (result.os.name) {
      // If no device type detected, try to infer from OS
      const osName = result.os.name.toLowerCase();
      if (osName.includes('ios') || osName.includes('android')) {
        deviceType = 'mobile';
      } else if (osName.includes('windows') || osName.includes('mac') || osName.includes('linux')) {
        deviceType = 'desktop';
      }
    }
    
    // Determine device brand/vendor
    let deviceBrand = result.device.vendor || result.device.model || 'Unknown';
    
    // If we have OS information but no device vendor, try to infer brand
    if (deviceBrand === 'Unknown' && result.os.name) {
      const osName = result.os.name.toLowerCase();
      if (osName.includes('ios') || osName.includes('mac')) {
        deviceBrand = 'Apple';
      } else if (osName.includes('windows')) {
        deviceBrand = 'Windows PC';
      } else if (osName.includes('android')) {
        deviceBrand = 'Android Device';
      } else if (osName.includes('linux')) {
        deviceBrand = 'Linux PC';
      }
    }
    
    return {
      browser: {
        name: result.browser.name || 'Unknown',
        version: result.browser.version || '',
        engine: result.engine.name || ''
      },
      device: {
        type: deviceType,
        brand: deviceBrand,
        os: {
          name: result.os.name || 'Unknown',
          version: result.os.version || ''
        }
      }
    };
  }

  private static normalizeIP(ip?: string): string {
    if (!ip) {
      return '127.0.0.1';
    }

    const trimmed = ip.trim();
    const withoutBrackets = trimmed.replace(/[\[\]]/g, '');

    if (isIP(withoutBrackets)) {
      if (withoutBrackets.toLowerCase().startsWith('::ffff:')) {
        const mappedIpv4 = withoutBrackets.slice(7);
        if (isIP(mappedIpv4)) {
          return mappedIpv4;
        }
      }
      return withoutBrackets;
    }

    const ipv4Match = withoutBrackets.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4Match) {
      return ipv4Match[1];
    }

    const lastColonIndex = withoutBrackets.lastIndexOf(':');
    if (lastColonIndex !== -1) {
      const potentialPort = withoutBrackets.slice(lastColonIndex + 1);
      if (/^\d+$/.test(potentialPort)) {
        const candidate = withoutBrackets.slice(0, lastColonIndex);
        if (isIP(candidate)) {
          return candidate;
        }
      }
    }

    return withoutBrackets;
  }

  static getDeviceType(userAgentString: string): string {
    const ua = userAgentString.toLowerCase();
    
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    
    if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  static getLocationFromIP(ipAddress: string): LocationInfo {
    const normalizedIp = this.normalizeIP(ipAddress);

    // Skip local/private IPs
    if (this.isPrivateIP(normalizedIp)) {
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'UTC'
      };
    }

    const geo = geoip.lookup(normalizedIp);
    
    if (!geo) {
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'UTC'
      };
    }

    return {
      country: geo.country || 'Unknown',
      region: geo.region || 'Unknown',
      city: geo.city || 'Unknown',
      timezone: geo.timezone || 'UTC'
    };
  }

  static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  static getClientIP(req: any): string {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0] ||
                  req.headers['x-real-ip'] ||
                  req.connection?.remoteAddress ||
                  req.socket?.remoteAddress ||
                  req.ip;

    return this.normalizeIP(rawIp);
  }

  static generateSessionId(req: any, visitorId?: string): string {
    const identifier = visitorId || this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = Date.now();
    
  // Create a session key that groups events by visitor (cookie fallback to IP) + hour
  // Sessions expire automatically when the hour changes
    const hourTimestamp = Math.floor(timestamp / (1000 * 60 * 60));
    
    return Buffer.from(`${identifier}-${userAgent}-${hourTimestamp}`).toString('base64');
  }

  static async isUniqueVisitor(
    sessionId: string,
    urlId: string,
    visitorId?: string,
    timeframe: number = 24
  ): Promise<boolean> {
    const hours = timeframe;
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const query: Record<string, unknown> = {
      url: urlId,
      visitedAt: { $gte: cutoff }
    };

    if (visitorId) {
      query.visitorId = visitorId;
    } else {
      query.sessionId = sessionId;
    }

    const existingVisit = await Visit.findOne(query);
    
    return !existingVisit;
  }

  static extractTimeComponents(date: Date = new Date()) {
    return {
      hour: date.getHours(),
      dayOfWeek: date.getDay(),
      dayOfMonth: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear()
    };
  }

  static formatReferrer(referrer?: string): string {
    if (!referrer || referrer === 'undefined') {
      return 'direct';
    }
    
    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch {
      return 'direct';
    }
  }
}

export default AnalyticsService;