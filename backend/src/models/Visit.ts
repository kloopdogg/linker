import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  brand?: string;
  os: {
    name?: string;
    version?: string;
  };
}

export interface IBrowserInfo {
  name: string;
  version?: string;
  engine?: string;
}

export interface IVisit extends Document {
  url: Types.ObjectId;
  shortCode: string;
  ipAddress: string;
  userAgent: string;
  referer: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  device: IDeviceInfo;
  browser: IBrowserInfo;
  visitorId?: string;
  sessionId?: string;
  isUniqueVisitor: boolean;
  visitedAt: Date;
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

const deviceInfoSchema = new Schema<IDeviceInfo>({
  type: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },
  brand: String,
  os: {
    name: String,
    version: String,
    _id: false
  }
}, { _id: false });

const browserInfoSchema = new Schema<IBrowserInfo>({
  name: {
    type: String,
    required: true
  },
  version: String,
  engine: String
}, { _id: false });

const visitSchema = new Schema<IVisit>({
  url: {
    type: Schema.Types.ObjectId,
    ref: 'Url',
    required: true
  },
  shortCode: {
    type: String,
    required: true
  },
  // Request information
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  referer: {
    type: String,
    default: 'direct'
  },
  // Geographic information
  country: {
    type: String
  },
  region: {
    type: String
  },
  city: {
    type: String
  },
  timezone: {
    type: String
  },
  // Device information
  device: {
    type: deviceInfoSchema,
    required: true,
    default: () => ({ type: 'unknown', os: {} })
  },
  // Browser information
  browser: {
    type: browserInfoSchema,
    required: true
  },
  // Session tracking
  visitorId: {
    type: String
  },
  sessionId: {
    type: String
  },
  isUniqueVisitor: {
    type: Boolean,
    default: false
  },
  // Timestamp information
  visitedAt: {
    type: Date,
    default: Date.now
  },
  hour: {
    type: Number,
    min: 0,
    max: 23,
    required: true
  },
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    required: true
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
    required: true
  },
  month: {
    type: Number,
    min: 0,
    max: 11,
    required: true
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for analytics performance
visitSchema.index({ url: 1, visitedAt: -1 });
visitSchema.index({ shortCode: 1, visitedAt: -1 });
visitSchema.index({ visitedAt: -1 });
visitSchema.index({ country: 1, visitedAt: -1 });
visitSchema.index({ 'device.type': 1, visitedAt: -1 });
visitSchema.index({ 'browser.name': 1, visitedAt: -1 });
visitSchema.index({ hour: 1, dayOfWeek: 1 });
visitSchema.index({ isUniqueVisitor: 1 });
visitSchema.index({ url: 1, visitorId: 1, visitedAt: -1 });

// Compound indexes for complex queries
visitSchema.index({ url: 1, country: 1, visitedAt: -1 });
visitSchema.index({ url: 1, 'device.type': 1, visitedAt: -1 });
visitSchema.index({ url: 1, 'browser.name': 1, visitedAt: -1 });
visitSchema.index({ shortCode: 1, isUniqueVisitor: 1, visitedAt: -1 });

// Time-based partitioning indexes
visitSchema.index({ year: 1, month: 1, visitedAt: -1 });
visitSchema.index({ year: 1, month: 1, url: 1 });

// Pre-save middleware to extract time components
visitSchema.pre('save', function(this: IVisit, next) {
  if (!this.visitedAt) {
    this.visitedAt = new Date();
  }
  
  const date = this.visitedAt;
  this.hour = date.getHours();
  this.dayOfWeek = date.getDay();
  this.dayOfMonth = date.getDate();
  this.month = date.getMonth();
  this.year = date.getFullYear();
  
  next();
});

export default mongoose.model<IVisit>('Visit', visitSchema);
