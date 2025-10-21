import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserPreferences {
  theme: 'light' | 'dark';
  timezone: string;
}

export interface IUser extends Document {
  azureId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user'; // Keep for backward compatibility
  isActive: boolean;
  lastLogin: Date;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
  // Methods for role management
  getRoles(): Promise<any[]>;
  hasRole(roleName: string): Promise<boolean>;
  hasPermission(resource: string, action: string): Promise<boolean>;
  assignRole(roleId: Types.ObjectId, assignedBy: Types.ObjectId): Promise<void>;
  removeRole(roleId: Types.ObjectId): Promise<void>;
}

const userPreferencesSchema = new Schema<IUserPreferences>({
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  timezone: {
    type: String,
    default: 'UTC'
  }
}, { _id: false });

const userSchema = new Schema<IUser>({
  azureId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// Note: azureId and email indexes are created automatically due to unique: true
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Instance methods for role management
userSchema.methods.getRoles = async function() {
  const UserRole = mongoose.model('UserRole');
  const Role = mongoose.model('Role');
  
  const userRoles = await UserRole.find({
    userId: this._id,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).populate('roleId');
  
  return userRoles.map(ur => ur.roleId);
};

userSchema.methods.hasRole = async function(roleName: string) {
  const roles = await this.getRoles();
  return roles.some((role: any) => role.name === roleName.toUpperCase());
};

userSchema.methods.hasPermission = async function(resource: string, action: string) {
  const roles = await this.getRoles();
  
  for (const role of roles) {
    const permission = role.permissions.find((p: any) => p.resource === resource);
    if (permission && permission.actions.includes(action)) {
      return true;
    }
  }
  
  return false;
};

userSchema.methods.assignRole = async function(roleId: Types.ObjectId, assignedBy: Types.ObjectId) {
  const UserRole = mongoose.model('UserRole');
  
  await UserRole.findOneAndUpdate(
    { userId: this._id, roleId },
    {
      userId: this._id,
      roleId,
      assignedBy,
      assignedAt: new Date(),
      isActive: true
    },
    { upsert: true }
  );
};

userSchema.methods.removeRole = async function(roleId: Types.ObjectId) {
  const UserRole = mongoose.model('UserRole');
  
  await UserRole.findOneAndUpdate(
    { userId: this._id, roleId },
    { isActive: false }
  );
};

export default mongoose.model<IUser>('User', userSchema);