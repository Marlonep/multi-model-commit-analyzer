import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration script to add organizations table and normalize data
export async function migrateToOrganizationsTable() {
    const dbPath = path.join(__dirname, 'commit_analyzer.db');
    const db = new Database(dbPath);
    
    console.log('Starting organizations table migration...');
    
    try {
        // Create organizations table
        db.exec(`
            CREATE TABLE IF NOT EXISTS organizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                display_name TEXT,
                description TEXT,
                website TEXT,
                github_url TEXT,
                logo_url TEXT,
                location TEXT,
                industry TEXT,
                size_category TEXT CHECK (size_category IN ('startup', 'small', 'medium', 'large', 'enterprise')),
                founded_date DATE,
                timezone TEXT,
                primary_language TEXT,
                tech_stack TEXT DEFAULT '[]',
                contact_email TEXT,
                contact_phone TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create user_organizations junction table
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_organizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                organization_id INTEGER NOT NULL,
                role TEXT,
                department TEXT,
                join_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                UNIQUE(user_id, organization_id)
            )
        `);
        
        // Add organization_id column to commits table
        try {
            db.exec(`ALTER TABLE commits ADD COLUMN organization_id INTEGER REFERENCES organizations(id)`);
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                throw error;
            }
            console.log('organization_id column already exists in commits table');
        }
        
        // Create index for better performance
        db.exec(`CREATE INDEX IF NOT EXISTS idx_commits_organization_id ON commits(organization_id)`);
        
        // Extract unique organizations from existing commits
        const existingOrgs = db.prepare(`
            SELECT DISTINCT organization FROM commits 
            WHERE organization IS NOT NULL AND organization != ''
        `).all();
        
        const insertOrg = db.prepare(`
            INSERT OR IGNORE INTO organizations (name, slug, display_name, github_url) 
            VALUES (?, ?, ?, ?)
        `);
        
        // Insert organizations and build mapping
        const orgMap = new Map();
        
        for (const org of existingOrgs) {
            const orgName = org.organization;
            const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const githubUrl = `https://github.com/${orgName}`;
            
            insertOrg.run(orgName, slug, orgName, githubUrl);
            
            // Get the organization ID
            const orgRecord = db.prepare('SELECT id FROM organizations WHERE name = ?').get(orgName);
            if (orgRecord) {
                orgMap.set(orgName, orgRecord.id);
            }
        }
        
        // Update commits with organization_id
        const updateCommit = db.prepare(`
            UPDATE commits SET organization_id = ? WHERE organization = ?
        `);
        
        for (const [orgName, orgId] of orgMap) {
            updateCommit.run(orgId, orgName);
        }
        
        // Migrate user organizations from JSON to junction table
        const users = db.prepare('SELECT id, user_id FROM user_details WHERE organizations IS NOT NULL').all();
        const insertUserOrg = db.prepare(`
            INSERT OR IGNORE INTO user_organizations (user_id, organization_id, role, join_date, is_active)
            VALUES (?, ?, ?, ?, 1)
        `);
        
        for (const userDetail of users) {
            try {
                const organizations = JSON.parse(userDetail.organizations || '[]');
                
                for (const userOrg of organizations) {
                    // Find or create organization
                    let orgId = orgMap.get(userOrg.name);
                    
                    if (!orgId) {
                        const slug = userOrg.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                        insertOrg.run(userOrg.name, slug, userOrg.name, null);
                        
                        const orgRecord = db.prepare('SELECT id FROM organizations WHERE name = ?').get(userOrg.name);
                        if (orgRecord) {
                            orgId = orgRecord.id;
                            orgMap.set(userOrg.name, orgId);
                        }
                    }
                    
                    if (orgId) {
                        insertUserOrg.run(
                            userDetail.user_id,
                            orgId,
                            userOrg.role || null,
                            userOrg.joinDate || null
                        );
                    }
                }
            } catch (error) {
                console.warn(`Failed to parse organizations for user ${userDetail.user_id}:`, error.message);
            }
        }
        
        console.log(`Migration completed successfully!`);
        console.log(`- Created organizations table with ${orgMap.size} organizations`);
        console.log(`- Created user_organizations junction table`);
        console.log(`- Added organization_id to commits table`);
        console.log(`- Migrated user organization relationships`);
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToOrganizationsTable().catch(console.error);
}