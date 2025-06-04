import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('./commit_analyzer.db');

console.log('=== Users in SQLite Database ===');
const users = db.prepare('SELECT id, username, name, role, status, created_at FROM users').all();
console.log(JSON.stringify(users, null, 2));

console.log('\n=== Testing admin password ===');
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (adminUser) {
    console.log('Admin user found in database');
    console.log(`Username: ${adminUser.username}`);
    console.log(`Role: ${adminUser.role}`);
    console.log(`Status: ${adminUser.status}`);
    
    // Test if password is 'admin'
    const isValidPassword = await bcrypt.compare('admin', adminUser.password_hash);
    console.log(`Password 'admin' is valid: ${isValidPassword}`);
    
    // Also test against common passwords
    const testPasswords = ['admin123', 'password', 'Administrator'];
    for (const pwd of testPasswords) {
        const isValid = await bcrypt.compare(pwd, adminUser.password_hash);
        if (isValid) {
            console.log(`Password '${pwd}' is valid: ${isValid}`);
        }
    }
} else {
    console.log('Admin user NOT found in database');
}

db.close();