import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICountryAnalytics {
  country: string;
  visits: number;
  uniqueVisits: number;
}

export interface IDeviceAnalytics {
  type: string;
  visits: number;
  uniqueVisits: number;
}

export interface IBrowserAnalytics {
  name: string;
  visits: number;
  uniqueVisits: number;
}

export interface IHourlyBreakdown {
  hour: number;
  visits: number;
  uniqueVisits: number;
}

export interface IReferrerAnalytics {
  domain: string;
  visits: number;
  uniqueVisits: number;
}

export interface IAnalytics extends Document {
  url?: Types.ObjectId;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  date: Date;
  totalVisits: number;
  uniqueVisits: number;
  countries: ICountryAnalytics[];
  devices: IDeviceAnalytics[];
  browsers: IBrowserAnalytics[];
  hourlyBreakdown: IHourlyBreakdown[];
  referrers: IReferrerAnalytics[];
  createdAt: Date;
  updatedAt: Date;
}

const countryAnalyticsSchema = new Schema<ICountryAnalytics>({
  country: String,
  visits: Number,
  uniqueVisits: Number
}, { _id: false });

const deviceAnalyticsSchema = new Schema<IDeviceAnalytics>({
  type: String,
  visits: Number,
  uniqueVisits: Number
}, { _id: false });

const browserAnalyticsSchema = new Schema<IBrowserAnalytics>({
  name: String,
  visits: Number,
  uniqueVisits: Number
}, { _id: false });

const hourlyBreakdownSchema = new Schema<IHourlyBreakdown>({
  hour: {
    type: Number,
    min: 0,
    max: 23
  },
  visits: Number,
  uniqueVisits: Number
}, { _id: false });

const referrerAnalyticsSchema = new Schema<IReferrerAnalytics>({
  domain: String,
  visits: Number,
  uniqueVisits: Number
}, { _id: false });

const analyticsSchema = new Schema<IAnalytics>({
  url: {
    type: Schema.Types.ObjectId,
    ref: 'Url',
    index: true
  },
  // null url means global analytics
  period: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Basic metrics
  totalVisits: {
    type: Number,
    default: 0
  },
  uniqueVisits: {
    type: Number,
    default: 0
  },
  // Geographic breakdown
  countries: [countryAnalyticsSchema],
  // Device breakdown
  devices: [deviceAnalyticsSchema],
  // Browser breakdown
  browsers: [browserAnalyticsSchema],
  // Hourly breakdown (for daily aggregation)
  hourlyBreakdown: [hourlyBreakdownSchema],
  // Top referrers
  referrers: [referrerAnalyticsSchema]
}, {
  timestamps: true
});

// Indexes for performance
analyticsSchema.index({ url: 1, period: 1, date: -1 });
analyticsSchema.index({ period: 1, date: -1 });
analyticsSchema.index({ date: -1 });

// Compound indexes
analyticsSchema.index({ url: 1, period: 1, date: 1 }, { unique: true });

export default mongoose.model<IAnalytics>('Analytics', analyticsSchema);