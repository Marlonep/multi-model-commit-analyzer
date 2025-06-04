import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('./commit_analyzer.db');

async function resetAdminPassword() {
    console.log('🔑 Resetting admin password...');
    
    // Hash the new password 'admin'
    const newPassword = 'admin';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update admin user
    const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
    const result = updateStmt.run(hashedPassword, 'admin');
    
    if (result.changes > 0) {
        console.log('✅ Admin password reset successfully!');
        console.log('   Username: admin');
        console.log('   Password: admin');
        
        // Verify the password works
        const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
        const isValid = await bcrypt.compare('admin', adminUser.password_hash);
        console.log('   Verification:', isValid ? '✅ Password works' : '❌ Password failed');
        
    } else {
        console.log('❌ Failed to update admin password');
    }
    
    db.close();
}

// Also create a test admin user if needed
async function ensureAdminExists() {
    console.log('👤 Ensuring admin user exists...');
    
    const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    
    if (!adminUser) {
        console.log('   Creating admin user...');
        const password = 'admin';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const insertStmt = db.prepare(`
            INSERT INTO users (username, password_hash, name, role, status)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        insertStmt.run('admin', hashedPassword, 'Administrator', 'admin', 'active');
        console.log('   ✅ Admin user created');
    } else {
        console.log('   ✅ Admin user already exists');
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Status: ${adminUser.status}`);
    }
}

async function main() {
    try {
        await ensureAdminExists();
        await resetAdminPassword();
        
        console.log('\n🎯 Next steps:');
        console.log('1. Go to http://localhost:3000/login');
        console.log('2. Login with:');
        console.log('   Username: admin');
        console.log('   Password: admin');
        console.log('3. You should have full admin access to all pages');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();