import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create/open database
const dbPath = path.join(__dirname, 'commit_analyzer.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
const createTables = () => {
    // Users table (replaces users.json)
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // User details table (replaces user-details.json)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            email TEXT,
            phone TEXT,
            whatsapp_available BOOLEAN DEFAULT 0,
            min_hours_per_day INTEGER DEFAULT 8,
            organizations TEXT DEFAULT '[]', -- JSON as TEXT
            tools TEXT DEFAULT '[]', -- JSON as TEXT
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Commits table (replaces commit_analysis_history.json)
    db.exec(`
        CREATE TABLE IF NOT EXISTS commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commit_hash TEXT NOT NULL,
            user_name TEXT NOT NULL, -- The commit author name
            user_id INTEGER, -- Link to actual user account
            project TEXT,
            organization TEXT,
            commit_message TEXT,
            timestamp DATETIME NOT NULL,
            file_changes INTEGER DEFAULT 0,
            lines_added INTEGER DEFAULT 0,
            lines_deleted INTEGER DEFAULT 0,
            
            -- Analysis scores
            average_code_quality REAL DEFAULT 0,
            average_dev_level REAL DEFAULT 0,
            average_complexity REAL DEFAULT 0,
            average_estimated_hours REAL DEFAULT 0,
            average_estimated_hours_with_ai REAL DEFAULT 0,
            average_ai_percentage REAL DEFAULT 0,
            
            -- Cost tracking
            total_cost REAL DEFAULT 0,
            tokens_used INTEGER DEFAULT 0,
            
            -- Status and metadata
            status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'abnormal', 'error')),
            manually_reviewed BOOLEAN DEFAULT 0,
            status_log TEXT DEFAULT '[]', -- JSON as TEXT
            
            -- Analysis details (stored as JSON)
            analysis_details TEXT, -- JSON as TEXT
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Daily commits summary table (replaces daily-commits.json)
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            user_name TEXT NOT NULL,
            user_id INTEGER,
            total_commits INTEGER DEFAULT 0,
            total_lines_added INTEGER DEFAULT 0,
            total_lines_deleted INTEGER DEFAULT 0,
            total_hours REAL DEFAULT 0,
            average_quality REAL DEFAULT 0,
            average_complexity REAL DEFAULT 0,
            summary TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, user_name),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Tools table (replaces tools-data.json)
    db.exec(`
        CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id TEXT UNIQUE NOT NULL,
            image TEXT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            price TEXT,
            cost_per_month REAL,
            website TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Create indexes for better performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_commits_user_name ON commits(user_name);
        CREATE INDEX IF NOT EXISTS idx_commits_user_id ON commits(user_id);
        CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project);
        CREATE INDEX IF NOT EXISTS idx_commits_hash ON commits(commit_hash);
        CREATE INDEX IF NOT EXISTS idx_daily_commits_date ON daily_commits(date DESC);
        CREATE INDEX IF NOT EXISTS idx_daily_commits_user ON daily_commits(user_name);
    `);

    // Create triggers for updated_at
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
        AFTER UPDATE ON users
        BEGIN
            UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_user_details_timestamp 
        AFTER UPDATE ON user_details
        BEGIN
            UPDATE user_details SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_commits_timestamp 
        AFTER UPDATE ON commits
        BEGIN
            UPDATE commits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_daily_commits_timestamp 
        AFTER UPDATE ON daily_commits
        BEGIN
            UPDATE daily_commits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);

    console.log('✅ Database tables created successfully');
};

// Database helper functions
export const dbHelpers = {
    // Users
    getAllUsers() {
        return db.prepare('SELECT id, username, name, role, status, created_at FROM users ORDER BY created_at DESC').all();
    },

    getUserByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },

    getUserById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    createUser(userData) {
        const stmt = db.prepare(`
            INSERT INTO users (username, password_hash, name, role, status)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userData.username, userData.password_hash, userData.name, userData.role, userData.status || 'active');
    },

    updateUser(id, userData) {
        const stmt = db.prepare(`
            UPDATE users 
            SET username = ?, name = ?, role = ?, status = ?
            ${userData.password_hash ? ', password_hash = ?' : ''}
            WHERE id = ?
        `);
        const params = [userData.username, userData.name, userData.role, userData.status];
        if (userData.password_hash) {
            params.push(userData.password_hash);
        }
        params.push(id);
        return stmt.run(...params);
    },

    deleteUser(id) {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },

    // User Details
    getUserDetails(userId) {
        const result = db.prepare('SELECT * FROM user_details WHERE user_id = ?').get(userId);
        if (result) {
            // Parse JSON fields
            result.organizations = JSON.parse(result.organizations || '[]');
            result.tools = JSON.parse(result.tools || '[]');
        }
        return result;
    },

    getUserDetailsByUsername(username) {
        const result = db.prepare(`
            SELECT ud.* FROM user_details ud
            JOIN users u ON ud.user_id = u.id
            WHERE u.username = ?
        `).get(username);
        if (result) {
            result.organizations = JSON.parse(result.organizations || '[]');
            result.tools = JSON.parse(result.tools || '[]');
        }
        return result;
    },

    createOrUpdateUserDetails(userId, details) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO user_details 
            (user_id, email, phone, whatsapp_available, min_hours_per_day, organizations, tools)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            userId,
            details.email || '',
            details.phone || '',
            details.whatsapp_available ? 1 : 0,
            details.min_hours_per_day || 8,
            JSON.stringify(details.organizations || []),
            JSON.stringify(details.tools || [])
        );
    },

    // Commits
    getAllCommits(userRole, userId, username) {
        if (userRole === 'admin') {
            return db.prepare('SELECT * FROM commits ORDER BY timestamp DESC').all();
        } else {
            // Regular users see only their commits
            return db.prepare(`
                SELECT * FROM commits 
                WHERE user_id = ? OR user_name = ? 
                ORDER BY timestamp DESC
            `).all(userId, username);
        }
    },

    getCommitByIndex(index, userRole, userId, username) {
        const allCommits = this.getAllCommits(userRole, userId, username);
        return allCommits[index] || null;
    },

    getCommitByHash(hash) {
        return db.prepare('SELECT * FROM commits WHERE commit_hash = ?').get(hash);
    },

    createCommit(commitData) {
        const stmt = db.prepare(`
            INSERT INTO commits (
                commit_hash, user_name, user_id, project, organization, commit_message,
                timestamp, file_changes, lines_added, lines_deleted, average_code_quality,
                average_dev_level, average_complexity, average_estimated_hours,
                average_estimated_hours_with_ai, average_ai_percentage, total_cost,
                tokens_used, status, manually_reviewed, status_log, analysis_details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Try to find user_id from user_name
        const user = this.getUserByUsername(commitData.user_name);
        const userId = user ? user.id : null;
        
        return stmt.run(
            commitData.commit_hash,
            commitData.user_name,
            userId,
            commitData.project,
            commitData.organization,
            commitData.commit_message,
            commitData.timestamp,
            commitData.file_changes || 0,
            commitData.lines_added || 0,
            commitData.lines_deleted || 0,
            commitData.average_code_quality || 0,
            commitData.average_dev_level || 0,
            commitData.average_complexity || 0,
            commitData.average_estimated_hours || 0,
            commitData.average_estimated_hours_with_ai || 0,
            commitData.average_ai_percentage || 0,
            commitData.total_cost || 0,
            commitData.tokens_used || 0,
            commitData.status || 'ok',
            commitData.manually_reviewed ? 1 : 0,
            JSON.stringify(commitData.status_log || []),
            JSON.stringify(commitData.analysis_details || {})
        );
    },

    updateCommitStatus(hash, status, changedBy) {
        const commit = this.getCommitByHash(hash);
        if (!commit) return null;

        // Parse existing status log
        const statusLog = JSON.parse(commit.status_log || '[]');
        statusLog.push({
            previousStatus: commit.status,
            newStatus: status,
            changedBy: changedBy || 'System',
            timestamp: new Date().toISOString(),
            reason: 'Manual status change'
        });

        const stmt = db.prepare(`
            UPDATE commits 
            SET status = ?, manually_reviewed = 1, status_log = ?
            WHERE commit_hash = ?
        `);
        return stmt.run(status, JSON.stringify(statusLog), hash);
    },

    deleteCommit(hash) {
        return db.prepare('DELETE FROM commits WHERE commit_hash = ?').run(hash);
    },

    // Daily Commits
    getAllDailyCommits() {
        return db.prepare('SELECT * FROM daily_commits ORDER BY date DESC').all();
    },

    createOrUpdateDailyCommit(dailyData) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_commits 
            (date, user_name, user_id, total_commits, total_lines_added, total_lines_deleted,
             total_hours, average_quality, average_complexity, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Try to find user_id from user_name
        const user = this.getUserByUsername(dailyData.user_name);
        const userId = user ? user.id : null;
        
        return stmt.run(
            dailyData.date,
            dailyData.user_name,
            userId,
            dailyData.total_commits || 0,
            dailyData.total_lines_added || 0,
            dailyData.total_lines_deleted || 0,
            dailyData.total_hours || 0,
            dailyData.average_quality || 0,
            dailyData.average_complexity || 0,
            dailyData.summary || ''
        );
    },

    // Tools
    getAllTools() {
        return db.prepare('SELECT * FROM tools ORDER BY name ASC').all();
    },

    getToolById(id) {
        return db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
    },

    getToolByToolId(toolId) {
        return db.prepare('SELECT * FROM tools WHERE tool_id = ?').get(toolId);
    },

    createTool(toolData, userId) {
        const stmt = db.prepare(`
            INSERT INTO tools (tool_id, image, name, category, description, price, cost_per_month, website, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            toolData.tool_id || toolData.id,
            toolData.image || null,
            toolData.name,
            toolData.category,
            toolData.description || '',
            toolData.price || null,
            toolData.cost_per_month || toolData.costPerMonth || null,
            toolData.website || null,
            userId || null
        );
    },

    updateTool(id, toolData) {
        const stmt = db.prepare(`
            UPDATE tools 
            SET image = ?, name = ?, category = ?, description = ?, 
                price = ?, cost_per_month = ?, website = ?
            WHERE id = ?
        `);
        
        return stmt.run(
            toolData.image || null,
            toolData.name,
            toolData.category,
            toolData.description || '',
            toolData.price || null,
            toolData.cost_per_month || toolData.costPerMonth || null,
            toolData.website || null,
            id
        );
    },

    deleteTool(id) {
        return db.prepare('DELETE FROM tools WHERE id = ?').run(id);
    }
};

// Initialize database
createTables();

// Insert default admin user if not exists
const adminUser = dbHelpers.getUserByUsername('admin');
if (!adminUser) {
    dbHelpers.createUser({
        username: 'admin',
        password_hash: '$2b$10$TKR0lofZVaffqgKsBoL.KOku95vAcEy78amOS2qK.HjYzOYQIS0qG', // admin123
        name: 'Administrator',
        role: 'admin',
        status: 'active'
    });
    console.log('✅ Default admin user created');
}

export default db;
export { db };