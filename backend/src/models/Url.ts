import mongoose, { Document, Schema, Types } from 'mongoose';

export const MAX_SHORT_CODE_VALUE = 0xFFFFFF;

export const formatShortCodeFromValue = (value: number): string => {
  if (value < 0 || value > MAX_SHORT_CODE_VALUE) {
    throw new Error('shortCodeValue must be between 0 and 16777215');
  }

  return value.toString(16).padStart(6, '0');
};

export interface IQRCodeCustomization {
  foregroundColor: string;
  backgroundColor: string;
  logo?: string;
}

export interface IQRCode {
  dataUrl: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  customization: IQRCodeCustomization;
}

export interface IAnalyticsSummary {
  totalVisits: number;
  uniqueVisits: number;
  topCountries: Array<{ country: string; count: number }>;
  topDevices: Array<{ device: string; count: number }>;
  visitsToday: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
}

export interface IUrl extends Document {
  shortCode: string;
  shortCodeValue: number;
  originalUrl: string;
  title: string;
  description?: string;
  qrCode: IQRCode;
  isActive: boolean;
  expiresAt?: Date;
  tags: string[];
  createdBy: Types.ObjectId;
  visitCount: number;
  lastVisited?: Date;
  analytics: IAnalyticsSummary;
  shortUrl: string; // virtual
  createdAt: Date;
  updatedAt: Date;
}

const qrCodeCustomizationSchema = new Schema<IQRCodeCustomization>({
  foregroundColor: {
    type: String,
    default: '#000000'
  },
  backgroundColor: {
    type: String,
    default: '#FFFFFF'
  },
  logo: {
    type: String // Base64 encoded logo if provided
  }
}, { _id: false });

const qrCodeSchema = new Schema<IQRCode>({
  dataUrl: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 200
  },
  errorCorrectionLevel: {
    type: String,
    enum: ['L', 'M', 'Q', 'H'],
    default: 'M'
  },
  customization: {
    type: qrCodeCustomizationSchema,
    default: () => ({})
  }
}, { _id: false });

const analyticsSummarySchema = new Schema<IAnalyticsSummary>({
  totalVisits: {
    type: Number,
    default: 0
  },
  uniqueVisits: {
    type: Number,
    default: 0
  },
  topCountries: [{
    country: String,
    count: Number,
    _id: false
  }],
  topDevices: [{
    device: String,
    count: Number,
    _id: false
  }],
  visitsToday: {
    type: Number,
    default: 0
  },
  visitsThisWeek: {
    type: Number,
    default: 0
  },
  visitsThisMonth: {
    type: Number,
    default: 0
  }
}, { _id: false });

const urlSchema = new Schema<IUrl>({
  shortCode: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 6,
    maxlength: 6
  },
  shortCodeValue: {
    type: Number,
    required: true,
    unique: true,
    min: 0,
    max: MAX_SHORT_CODE_VALUE,
    index: true
  },
  originalUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Must be a valid URL starting with http:// or https://'
    }
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  qrCode: {
    type: qrCodeSchema,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visitCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastVisited: {
    type: Date
  },
  analytics: {
    type: analyticsSummarySchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full short URL
urlSchema.virtual('shortUrl').get(function(this: IUrl) {
  return `${process.env.BASE_URL}/${this.shortCode}`;
});

// Indexes for performance
// Note: shortCode index is created automatically due to unique: true
urlSchema.index({ createdBy: 1 });
urlSchema.index({ isActive: 1 });
urlSchema.index({ createdAt: -1 });
urlSchema.index({ visitCount: -1 });
urlSchema.index({ lastVisited: -1 });
urlSchema.index({ tags: 1 });
urlSchema.index({ 'analytics.totalVisits': -1 });

// Compound indexes
urlSchema.index({ createdBy: 1, isActive: 1 });
urlSchema.index({ createdBy: 1, createdAt: -1 });

// Pre-save middleware to synchronize shortCode with shortCodeValue
urlSchema.pre('save', function(this: IUrl, next) {
  if (this.shortCodeValue === null || this.shortCodeValue === undefined) {
    return next(new Error('shortCodeValue is required'));
  }

  try {
    const formattedCode = formatShortCodeFromValue(this.shortCodeValue);
    if (this.shortCode !== formattedCode) {
      this.shortCode = formattedCode;
    }
  } catch (error) {
    return next(error as Error);
  }

  next();
});

export default mongoose.model<IUrl>('Url', urlSchema);