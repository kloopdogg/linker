import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  key: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const counterSchema = new Schema<ICounter>({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

export default mongoose.model<ICounter>('Counter', counterSchema);
