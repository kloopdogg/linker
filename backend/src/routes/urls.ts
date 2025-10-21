import express from 'express';
import { body, validationResult, query } from 'express-validator';
import UrlService from '../services/UrlService';
import QRCodeService from '../services/QRCodeService';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;

const router = express.Router();

// Validation middleware
const urlValidation = [
  body('originalUrl')
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Must be a valid URL'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date')
];

// Get all URLs with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
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

    const filters: any = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.tags) {
      filters.tags = (req.query.tags as string).split(',');
    }
    if (req.query.dateFrom) {
      filters.dateFrom = req.query.dateFrom as string;
    }
    if (req.query.dateTo) {
      filters.dateTo = req.query.dateTo as string;
    }

    const pagination = {
      page: req.query.page as string,
      limit: req.query.limit as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await UrlService.getUrls((req as any).user.userId, filters, pagination);

    res.json({
      success: true,
      data: result
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Create short URL
router.post('/', urlValidation, async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Validate QR code customization if provided
    if (req.body.qrCustomization) {
      const qrErrors = QRCodeService.validateCustomization(req.body.qrCustomization);
      if (qrErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'QR Code customization validation failed',
          errors: qrErrors
        });
      }
    }

    const url = await UrlService.createShortUrl(req.body, (req as any).user.userId);

    res.status(201).json({
      success: true,
      message: 'Short URL created successfully',
      data: url
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Get URL by ID
router.get('/:id', async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'URL ID is required'
      });
    }

    const url = await UrlService.getUrlById(req.params.id, (req as any).user.userId);

    res.json({
      success: true,
      data: url
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Update URL
router.put('/:id', [
  body('originalUrl').optional().isURL({ protocols: ['http', 'https'] }),
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('tags').optional().isArray()
], async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.params.id) {
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

    // Validate QR code customization if provided
    if (req.body.qrCustomization) {
      const qrErrors = QRCodeService.validateCustomization(req.body.qrCustomization);
      if (qrErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'QR Code customization validation failed',
          errors: qrErrors
        });
      }
    }

    const url = await UrlService.updateUrl(req.params.id, (req as any).user.userId, req.body);

    res.json({
      success: true,
      message: 'URL updated successfully',
      data: url
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Delete URL
router.delete('/:id', async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'URL ID is required'
      });
    }

    await UrlService.deleteUrl(req.params.id, (req as any).user.userId);

    res.json({
      success: true,
      message: 'URL deleted successfully'
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Generate new QR code for existing URL
router.post('/:id/qr-code', [
  body('customization').optional().isObject()
], async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.params.id) {
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

    const url = await UrlService.getUrlById(req.params.id, (req as any).user.userId);
    
    if (req.body.customization) {
      const qrErrors = QRCodeService.validateCustomization(req.body.customization);
      if (qrErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'QR Code customization validation failed',
          errors: qrErrors
        });
      }
    }

    const shortUrl = `${process.env.BASE_URL}/${(url as any).shortCode}`;
    const qrCode = await QRCodeService.generateQRCode(shortUrl, req.body.customization);

    res.json({
      success: true,
      data: qrCode
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;