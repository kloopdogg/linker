import RoleService from '../services/RoleService';

/**
 * Initialize the database with default roles and migrate existing users
 * This should be run when the application starts
 */
export async function initializeRoleSystem(): Promise<void> {
  try {
    console.log('Initializing role system...');
    
    const roleService = new RoleService();
    
    // Initialize default roles
    await roleService.initializeDefaultRoles();
    console.log('Default roles initialized');
    
    // Migrate existing users to the new role system
    await roleService.migrateExistingUsers();
    console.log('Existing users migrated to role system');
    
    console.log('Role system initialization complete');
  } catch (error) {
    console.error('Failed to initialize role system:', error);
    throw error;
  }
}

export default initializeRoleSystem;