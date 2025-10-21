import express from 'express';
import { nanoid } from 'nanoid';
import UrlService from '../services/UrlService';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;

const router = express.Router();

const VISITOR_COOKIE_NAME = 'linker_vid';
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [name, ...rest] = pair.split('=');
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return acc;
    }
    const rawValue = rest.join('=').trim();
    try {
      acc[trimmedName] = decodeURIComponent(rawValue);
    } catch {
      acc[trimmedName] = rawValue;
    }
    return acc;
  }, {});
};

const ensureVisitorId = (req: Request, res: Response): string => {
  const cookies = parseCookies(req.headers.cookie);
  const existingId = cookies[VISITOR_COOKIE_NAME];

  const visitorId = existingId || nanoid(24);

  res.cookie(VISITOR_COOKIE_NAME, visitorId, {
    maxAge: VISITOR_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return visitorId;
};

const sendErrorResponse = (res: Response, statusCode: number, title: string, message: string) => {
  // Return a minimal HTML error page so Azure App Service does not require a view engine
  res
    .status(statusCode)
    .type('html')
    .send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;background-color:#f6f6f6;color:#333;padding:40px;}main{background:#fff;border-radius:8px;padding:24px;max-width:480px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.1);}h1{margin-top:0;}p{line-height:1.5;}a{color:#0066cc;text-decoration:none;}a:hover{text-decoration:underline;}</style></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="/">Return home</a></p></main></body></html>`);
};

// Public redirect route - no authentication required
router.get('/:shortCode', async (req: Request, res: Response) => {
  try {
    const { shortCode } = req.params;
    
    // Validate short code format (allow existing URLs with hyphens/underscores)
    if (!shortCode || !/^[a-zA-Z0-9_-]{6}$/.test(shortCode)) {
      return sendErrorResponse(
        res,
        404,
        'Link Not Found',
        'The link you are looking for does not exist or has been removed.'
      );
    }

    const visitorId = ensureVisitorId(req, res);

    const destinationUrl = await UrlService.handleRedirect(shortCode, req, visitorId);
    
    if (!destinationUrl) {
      return sendErrorResponse(
        res,
        404,
        'Link Not Found',
        'The link you are looking for does not exist, has expired, or has been disabled.'
      );
    }

    // Redirect to the destination URL
    res.redirect(302, destinationUrl);
    
  } catch (error) {
    console.error('Redirect error:', error);
    sendErrorResponse(
      res,
      500,
      'Server Error',
      'An error occurred while processing your request. Please try again later.'
    );
  }
});

// Health check for redirect service
router.get('/health/check', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'redirect',
    timestamp: new Date().toISOString()
  });
});

export default router;