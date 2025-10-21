import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission {
  resource: string; // e.g., 'urls', 'analytics', 'users'
  actions: string[]; // e.g., ['read', 'write', 'delete']
}

export interface IRole extends Document {
  name: string;
  description: string;
  permissions: IPermission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>({
  resource: {
    type: String,
    required: true,
    trim: true
  },
  actions: [{
    type: String,
    required: true,
    trim: true
  }]
}, { _id: false });

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  permissions: [permissionSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// Note: name index is created automatically due to unique: true
roleSchema.index({ isActive: 1 });

export default mongoose.model<IRole>('Role', roleSchema);