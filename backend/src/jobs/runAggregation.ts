/**
 * Manual Aggregation Runner
 * 
 * Run this script to manually trigger analytics aggregation.
 * Useful for catching up on missed days or testing.
 * 
 * Usage:
 *   npx ts-node -r dotenv/config src/jobs/runAggregation.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import AnalyticsAggregationJob from './AnalyticsAggregationJob';

async function runAggregation() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set!');
    console.error('Make sure you have a .env file in the backend directory with MONGODB_URI defined.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...\n');
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');
    
    console.log('Starting analytics aggregation...\n');
    await AnalyticsAggregationJob.run();
    
    console.log('\n✓ Aggregation completed successfully!\n');
    
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Aggregation failed:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run the aggregation
runAggregation();
