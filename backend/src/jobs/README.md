# Analytics Aggregation Job

## Overview
The analytics aggregation job runs every 3 hours to pre-aggregate click data from previous days into the `analytics` collection for faster reporting.

## How It Works

### Scheduling
- **Cron Schedule**: `0 */3 * * *` (Every 3 hours at minute 0)
- **Runs at**: 12:00 AM, 3:00 AM, 6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 9:00 PM
- **Startup**: Also runs once when the server starts to catch up on any missed aggregations

### What Gets Aggregated
The job aggregates all days **before today**:
- Finds all visits from past days
- Groups them by URL (and globally)
- Creates daily summaries in the analytics table

### Data Aggregated
For each day and URL combination:
- **Basic metrics**: Total visits, unique visitors
- **Geographic**: Country breakdown with click counts
- **Device**: Device type breakdown (mobile, tablet, desktop)
- **Browser**: Browser name breakdown
- **Time patterns**: Hourly breakdown (0-23)
- **Referrers**: Top referring domains

### Smart Aggregation
- Only aggregates days that haven't been aggregated yet
- Uses MongoDB's unique index on `(url, period, date)` to prevent duplicates
- Skips "today" since it's still in progress
- Efficiently processes only new data

## Files

### `/src/jobs/AnalyticsAggregationJob.ts`
Contains the core aggregation logic:
- `run()` - Main entry point
- `aggregatePendingDays()` - Finds and processes all unaggregated days
- `aggregateDay()` - Aggregates a single day
- `aggregateForUrl()` - Aggregates for a specific URL or globally

### `/src/jobs/scheduler.ts`
Manages the cron scheduler:
- `start()` - Initializes all scheduled jobs
- `stop()` - Gracefully stops all jobs
- `triggerAnalyticsAggregation()` - Manual trigger for testing/admin

## Integration

The scheduler is initialized in `server.ts` after the database connection:
```typescript
await initializeRoleSystem();
JobScheduler.start(); // Starts all background jobs
```

And gracefully stopped on shutdown:
```typescript
process.on('SIGTERM', () => {
  JobScheduler.stop(); // Stops all background jobs
  mongoose.connection.close();
});
```

## Benefits

1. **Performance**: Reading from pre-aggregated analytics table is much faster than running aggregations on raw visits
2. **Scalability**: As click data grows, queries remain fast
3. **Resource efficiency**: Aggregations run periodically instead of on every analytics request
4. **Historical accuracy**: Locked-in daily summaries won't change as data ages

## Future Enhancements

- Add weekly and monthly aggregations
- Implement data retention policies (archive old click data after aggregation)
- Add monitoring and alerting for failed aggregations
- Create admin endpoint to manually trigger aggregation
- Add aggregation status tracking (last run time, success/failure)
