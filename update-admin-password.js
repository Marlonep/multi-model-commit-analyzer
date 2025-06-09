import { dbHelpers, db } from './database.js';
import bcrypt from 'bcryptjs';

// Update admin password to admin123
const hashedPassword = bcrypt.hashSync('admin123', 10);
const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
const result = stmt.run(hashedPassword, 'admin');
console.log('Admin password updated:', result.changes > 0 ? 'Success' : 'Failed');

// List all users
const users = dbHelpers.getAllUsers();
console.log('\nAll users in the system:');
console.log('========================');
users.forEach(user => {
  console.log(`Username: ${user.username}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Status: ${user.status}`);
  console.log(`  GitHub: ${user.github_username || 'Not set'}`);
  console.log('---');
});

// Check if there are other users we can create
console.log('\nNote: As admin, you can see ALL commits from ALL users.');
console.log('Regular users can only see their own commits.');

process.exit(0);