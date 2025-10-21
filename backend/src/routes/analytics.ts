import express from 'express';
import { query, validationResult } from 'express-validator';
import AnalyticsReportService from '../services/AnalyticsReportService';

const router = express.Router();

// Define the types from Express
type Request = express.Request;
type Response = express.Response;

// Validation middleware for date range
const dateRangeValidation = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('period').optional().isIn(['today', 'yesterday', 'last7days', 'last30days', 'last90days'])
    .withMessage('Period must be one of: today, yesterday, last7days, last30days, last90days')
];

// Analytics overview
router.get('/overview', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getOverviewStats((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// URL-specific analytics
router.get('/visits/:urlId', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.params.urlId) {
      return res.status(400).json({
        success: false,
        message: 'URL ID is required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getUrlSpecificAnalytics(
      req.params.urlId, 
      (req as any).user.userId, 
      dateRange
    );

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Country analytics
router.get('/countries', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getCountryAnalytics((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Device analytics
router.get('/devices', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getDeviceAnalytics((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Device type breakdown
router.get('/device-types', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getDeviceTypeBreakdown((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Mobile device breakdown
router.get('/mobile-devices', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getMobileDeviceBreakdown((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Time pattern analytics
router.get('/time-patterns', dateRangeValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const analytics = await AnalyticsReportService.getTimePatternAnalytics((req as any).user.userId, dateRange);

    res.json({
      success: true,
      data: analytics
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Export analytics data
router.get('/export', dateRangeValidation, [
  query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  query('type').optional().isIn(['overview', 'countries', 'devices', 'time-patterns'])
    .withMessage('Type must be one of: overview, countries, devices, time-patterns')
], async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateRange = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      period: (req.query.period as any) || 'last30days'
    };

    const format = (req.query.format as string) || 'json';
    const type = (req.query.type as string) || 'overview';

    let data: any;
    switch (type) {
      case 'countries':
        data = await AnalyticsReportService.getCountryAnalytics((req as any).user.userId, dateRange);
        break;
      case 'devices':
        data = await AnalyticsReportService.getDeviceAnalytics((req as any).user.userId, dateRange);
        break;
      case 'time-patterns':
        data = await AnalyticsReportService.getTimePatternAnalytics((req as any).user.userId, dateRange);
        break;
      default:
        data = await AnalyticsReportService.getOverviewStats((req as any).user.userId, dateRange);
    }

    if (format === 'csv') {
      // Convert to CSV format
      let csv = '';
      if (type === 'countries' && Array.isArray(data)) {
        csv = 'Country,Visits,Unique Visits,Percentage\n';
        csv += data.map((item: any) => 
          `"${item.country}",${item.visits},${item.uniqueVisits},${item.percentage}%`
        ).join('\n');
      } else if (type === 'devices') {
        csv = 'Device Type,Visits,Unique Visits,Percentage\n';
        csv += data.devices.map((item: any) => 
          `"${item.type}",${item.visits},${item.uniqueVisits},${item.percentage}%`
        ).join('\n');
      } else {
        // Default to JSON for complex data
        csv = JSON.stringify(data, null, 2);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
      return;
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        dateRange,
        type,
        data
      });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
});

export default router;