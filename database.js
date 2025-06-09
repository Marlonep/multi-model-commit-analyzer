import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
            
            -- Model scores (stored as JSON array)
            model_scores TEXT, -- JSON as TEXT
            
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
            average_dev_level REAL DEFAULT 0,
            projects TEXT DEFAULT '[]', -- JSON as TEXT
            commit_hashes TEXT DEFAULT '[]', -- JSON as TEXT
            commit_indices TEXT DEFAULT '[]', -- JSON as TEXT
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

    // AI Models table (stores all AI model configuration and performance data)
    db.exec(`
        CREATE TABLE IF NOT EXISTS ai_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id TEXT UNIQUE NOT NULL,
            provider TEXT NOT NULL,
            model_name TEXT NOT NULL,
            status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
            input_cost TEXT NOT NULL,
            output_cost TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            parameters TEXT DEFAULT '{}', -- JSON as TEXT
            env_var TEXT NOT NULL,
            model_type TEXT NOT NULL,
            notes TEXT,
            
            -- Performance metrics
            avg_quality_score REAL DEFAULT 0,
            avg_response_time REAL DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            total_cost REAL DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            total_analyses INTEGER DEFAULT 0,
            last_error TEXT,
            last_used_at DATETIME,
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Encrypted API Keys table (stores encrypted API keys with metadata)
    db.exec(`
        CREATE TABLE IF NOT EXISTS encrypted_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT NOT NULL,
            encrypted_key TEXT NOT NULL,
            provider TEXT NOT NULL,
            user_id INTEGER,
            is_global BOOLEAN DEFAULT 1,
            last_used_at DATETIME,
            key_version INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(key_name, user_id, is_global)
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
        CREATE INDEX IF NOT EXISTS idx_ai_models_model_id ON ai_models(model_id);
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

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_ai_models_timestamp 
        AFTER UPDATE ON ai_models
        BEGIN
            UPDATE ai_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);

    // Add model_scores column if it doesn't exist (for existing databases)
    try {
        const columnExists = db.prepare(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('commits') 
            WHERE name = 'model_scores'
        `).get();
        
        if (columnExists.count === 0) {
            db.exec('ALTER TABLE commits ADD COLUMN model_scores TEXT');
            console.log('✅ Added model_scores column to existing commits table');
        }
    } catch (error) {
        console.log('ℹ️  model_scores column already exists or error adding:', error.message);
    }

    // Add github_username column if it doesn't exist (for existing databases)
    try {
        const columnExists = db.prepare(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('users') 
            WHERE name = 'github_username'
        `).get();
        
        if (columnExists.count === 0) {
            db.exec('ALTER TABLE users ADD COLUMN github_username TEXT');
            console.log('✅ Added github_username column to existing users table');
        }
    } catch (error) {
        console.log('ℹ️  github_username column already exists or error adding:', error.message);
    }

    // Add github_username column to commits table if it doesn't exist
    try {
        const columnExists = db.prepare(`
            SELECT COUNT(*) as count 
            FROM pragma_table_info('commits') 
            WHERE name = 'github_username'
        `).get();
        
        if (columnExists.count === 0) {
            db.exec('ALTER TABLE commits ADD COLUMN github_username TEXT');
            console.log('✅ Added github_username column to existing commits table');
            
            // Migrate existing data
            console.log('🔄 Migrating existing commit data...');
            
            // Set default GitHub usernames for known users
            const userMappings = [
                { username: 'admin', github_username: 'admin' },
                { username: 'Marlonep', github_username: 'Marlonep' },
                { username: 'mariogc00', github_username: 'mariogc00' },
                { username: 'bruno', github_username: 'bruno' },
                { username: 'user', github_username: 'user' }
            ];

            userMappings.forEach(mapping => {
                try {
                    const result = db.prepare(`
                        UPDATE users 
                        SET github_username = ? 
                        WHERE username = ? AND github_username IS NULL
                    `).run(mapping.github_username, mapping.username);
                    
                    if (result.changes > 0) {
                        console.log(`✅ Set GitHub username for user: ${mapping.username} -> ${mapping.github_username}`);
                    }
                } catch (err) {
                    console.log(`ℹ️  Could not update user ${mapping.username}:`, err.message);
                }
            });

            // Link commits to GitHub usernames based on Git author names
            try {
                const marlonResult = db.prepare(`
                    UPDATE commits 
                    SET github_username = 'Marlonep' 
                    WHERE user_name = 'Marlon Espinosa' AND github_username IS NULL
                `).run();
                
                if (marlonResult.changes > 0) {
                    console.log(`✅ Linked ${marlonResult.changes} commits from "Marlon Espinosa" to GitHub user "Marlonep"`);
                }
            } catch (err) {
                console.log('ℹ️  Could not link Marlon commits:', err.message);
            }
        }
    } catch (error) {
        console.log('ℹ️  github_username column already exists in commits or error adding:', error.message);
    }

    // Add missing columns to daily_commits table for existing databases
    const dailyCommitsColumns = [
        { name: 'average_dev_level', type: 'REAL DEFAULT 0' },
        { name: 'projects', type: 'TEXT DEFAULT \'[]\'' },
        { name: 'commit_hashes', type: 'TEXT DEFAULT \'[]\'' },
        { name: 'commit_indices', type: 'TEXT DEFAULT \'[]\'' }
    ];

    for (const column of dailyCommitsColumns) {
        try {
            const columnExists = db.prepare(`
                SELECT COUNT(*) as count 
                FROM pragma_table_info('daily_commits') 
                WHERE name = '${column.name}'
            `).get();
            
            if (columnExists.count === 0) {
                db.exec(`ALTER TABLE daily_commits ADD COLUMN ${column.name} ${column.type}`);
                console.log(`✅ Added ${column.name} column to existing daily_commits table`);
            }
        } catch (error) {
            console.log(`ℹ️  ${column.name} column already exists or error adding:`, error.message);
        }
    }

    console.log('✅ Database tables created successfully');
};

// Database helper functions
export const dbHelpers = {
    // Organizations
    getAllOrganizations() {
        return db.prepare('SELECT * FROM organizations WHERE is_active = 1 ORDER BY name').all();
    },

    getOrganizationById(id) {
        return db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
    },

    getOrganizationByName(name) {
        return db.prepare('SELECT * FROM organizations WHERE name = ?').get(name);
    },

    getOrganizationBySlug(slug) {
        return db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug);
    },

    createOrganization(orgData) {
        const stmt = db.prepare(`
            INSERT INTO organizations (
                name, slug, display_name, description, website, github_url, 
                logo_url, location, industry, size_category, founded_date, 
                timezone, primary_language, tech_stack, contact_email, contact_phone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            orgData.name,
            orgData.slug,
            orgData.display_name,
            orgData.description,
            orgData.website,
            orgData.github_url,
            orgData.logo_url,
            orgData.location,
            orgData.industry,
            orgData.size_category,
            orgData.founded_date,
            orgData.timezone,
            orgData.primary_language,
            JSON.stringify(orgData.tech_stack || []),
            orgData.contact_email,
            orgData.contact_phone
        );
    },

    updateOrganization(id, orgData) {
        const stmt = db.prepare(`
            UPDATE organizations SET 
                name = ?, slug = ?, display_name = ?, description = ?, website = ?, 
                github_url = ?, logo_url = ?, location = ?, industry = ?, 
                size_category = ?, founded_date = ?, timezone = ?, primary_language = ?, 
                tech_stack = ?, contact_email = ?, contact_phone = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(
            orgData.name,
            orgData.slug,
            orgData.display_name,
            orgData.description,
            orgData.website,
            orgData.github_url,
            orgData.logo_url,
            orgData.location,
            orgData.industry,
            orgData.size_category,
            orgData.founded_date,
            orgData.timezone,
            orgData.primary_language,
            JSON.stringify(orgData.tech_stack || []),
            orgData.contact_email,
            orgData.contact_phone,
            id
        );
    },

    deleteOrganization(id) {
        return db.prepare('UPDATE organizations SET is_active = 0 WHERE id = ?').run(id);
    },


    getCommitsByOrganizationId(organizationId) {
        return db.prepare(`
            SELECT * FROM commits 
            WHERE organization_id = ? 
            ORDER BY timestamp DESC
        `).all(organizationId);
    },

    // Helper to find or create organization by name
    findOrCreateOrganization(orgName) {
        if (!orgName || orgName === 'Unknown') {
            return null;
        }
        
        // Try to find existing organization
        let org = this.getOrganizationByName(orgName);
        
        if (!org) {
            // Create new organization
            const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const githubUrl = `https://github.com/${orgName}`;
            
            const result = this.createOrganization({
                name: orgName,
                slug: slug,
                display_name: orgName,
                github_url: githubUrl,
                tech_stack: []
            });
            
            org = this.getOrganizationById(result.lastInsertRowid);
        }
        
        return org;
    },
    // Users
    getAllUsers() {
        return db.prepare('SELECT id, username, name, role, status, github_username, created_at FROM users ORDER BY created_at DESC').all();
    },

    getUserByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },

    getUserById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    getUserByGithubUsername(githubUsername) {
        return db.prepare('SELECT * FROM users WHERE github_username = ?').get(githubUsername);
    },

    createUser(userData) {
        const stmt = db.prepare(`
            INSERT INTO users (username, password_hash, name, role, status, github_username)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(userData.username, userData.password_hash, userData.name, userData.role, userData.status || 'active', userData.github_username || null);
    },

    updateUser(id, userData) {
        const stmt = db.prepare(`
            UPDATE users 
            SET username = ?, name = ?, role = ?, status = ?, github_username = ?
            ${userData.password_hash ? ', password_hash = ?' : ''}
            WHERE id = ?
        `);
        const params = [userData.username, userData.name, userData.role, userData.status, userData.github_username || null];
        if (userData.password_hash) {
            params.push(userData.password_hash);
        }
        params.push(id);
        return stmt.run(...params);
    },

    deleteUser(id) {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
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
                tokens_used, status, manually_reviewed, status_log, analysis_details, model_scores
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            JSON.stringify(commitData.analysis_details || {}),
            JSON.stringify(commitData.model_scores || [])
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
        // Check which columns exist in the table
        const tableInfo = db.prepare('PRAGMA table_info(daily_commits)').all();
        const existingColumns = new Set(tableInfo.map(col => col.name));
        
        // Build dynamic query based on existing columns
        const baseColumns = ['date', 'user_name', 'user_id', 'total_commits', 'total_lines_added', 'total_lines_deleted', 'total_hours', 'average_quality', 'average_complexity', 'summary'];
        const optionalColumns = ['average_dev_level', 'projects', 'commit_hashes', 'commit_indices'];
        
        const columnsToInsert = baseColumns.filter(col => existingColumns.has(col));
        const optionalColumnsToInsert = optionalColumns.filter(col => existingColumns.has(col));
        
        const allColumns = [...columnsToInsert, ...optionalColumnsToInsert];
        const placeholders = allColumns.map(() => '?').join(', ');
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_commits (${allColumns.join(', ')})
            VALUES (${placeholders})
        `);
        
        // Try to find user_id from user_name
        const user = this.getUserByUsername(dailyData.user_name);
        const userId = user ? user.id : null;
        
        // Build values array
        const values = [];
        
        // Add base values
        if (existingColumns.has('date')) values.push(dailyData.date);
        if (existingColumns.has('user_name')) values.push(dailyData.user_name);
        if (existingColumns.has('user_id')) values.push(userId);
        if (existingColumns.has('total_commits')) values.push(dailyData.total_commits || 0);
        if (existingColumns.has('total_lines_added')) values.push(dailyData.total_lines_added || 0);
        if (existingColumns.has('total_lines_deleted')) values.push(dailyData.total_lines_deleted || 0);
        if (existingColumns.has('total_hours')) values.push(dailyData.total_hours || 0);
        if (existingColumns.has('average_quality')) values.push(dailyData.average_quality || 0);
        if (existingColumns.has('average_complexity')) values.push(dailyData.average_complexity || 0);
        if (existingColumns.has('summary')) values.push(dailyData.summary || '');
        
        // Add optional values
        if (existingColumns.has('average_dev_level')) values.push(dailyData.average_dev_level || 0);
        if (existingColumns.has('projects')) values.push(JSON.stringify(dailyData.projects || []));
        if (existingColumns.has('commit_hashes')) values.push(JSON.stringify(dailyData.commit_hashes || []));
        if (existingColumns.has('commit_indices')) values.push(JSON.stringify(dailyData.commit_indices || []));
        
        return stmt.run(...values);
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
    },

    // AI Models
    getAllAIModels() {
        return db.prepare('SELECT * FROM ai_models ORDER BY provider, model_name').all();
    },

    getAIModel(modelId) {
        return db.prepare('SELECT * FROM ai_models WHERE model_id = ?').get(modelId);
    },

    createOrUpdateAIModel(modelData) {
        const existing = this.getAIModel(modelData.model_id);
        
        if (existing) {
            // Update existing record
            const stmt = db.prepare(`
                UPDATE ai_models 
                SET provider = ?, model_name = ?, status = ?, 
                    input_cost = ?, output_cost = ?, api_endpoint = ?,
                    parameters = ?, env_var = ?, model_type = ?, notes = ?,
                    avg_quality_score = ?, avg_response_time = ?, 
                    total_tokens = ?, total_cost = ?, 
                    success_count = ?, error_count = ?, total_analyses = ?,
                    last_error = ?, last_used_at = ?
                WHERE model_id = ?
            `);
            
            return stmt.run(
                modelData.provider,
                modelData.model_name,
                modelData.status || 'inactive',
                modelData.input_cost,
                modelData.output_cost,
                modelData.api_endpoint,
                modelData.parameters || '{}',
                modelData.env_var,
                modelData.model_type,
                modelData.notes || null,
                modelData.avg_quality_score || 0,
                modelData.avg_response_time || 0,
                modelData.total_tokens || 0,
                modelData.total_cost || 0,
                modelData.success_count || 0,
                modelData.error_count || 0,
                modelData.total_analyses || 0,
                modelData.last_error || null,
                modelData.last_used_at || null,
                modelData.model_id
            );
        } else {
            // Create new record
            const stmt = db.prepare(`
                INSERT INTO ai_models (
                    model_id, provider, model_name, status, 
                    input_cost, output_cost, api_endpoint,
                    parameters, env_var, model_type, notes,
                    avg_quality_score, avg_response_time, 
                    total_tokens, total_cost, 
                    success_count, error_count, total_analyses,
                    last_error, last_used_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            return stmt.run(
                modelData.model_id,
                modelData.provider,
                modelData.model_name,
                modelData.status || 'inactive',
                modelData.input_cost,
                modelData.output_cost,
                modelData.api_endpoint,
                modelData.parameters || '{}',
                modelData.env_var,
                modelData.model_type,
                modelData.notes || null,
                modelData.avg_quality_score || 0,
                modelData.avg_response_time || 0,
                modelData.total_tokens || 0,
                modelData.total_cost || 0,
                modelData.success_count || 0,
                modelData.error_count || 0,
                modelData.total_analyses || 0,
                modelData.last_error || null,
                modelData.last_used_at || null
            );
        }
    },

    updateAIModelStatus(modelId, status) {
        return db.prepare('UPDATE ai_models SET status = ? WHERE model_id = ?').run(status, modelId);
    },

    updateAIModelPerformanceFromCommit(modelId, quality, responseTime, tokens, cost, success) {
        const existing = this.getAIModel(modelId);
        
        if (!existing) {
            console.warn(`Model ${modelId} not found in ai_models table`);
            return;
        }
        
        // Update with incremental statistics
        const stmt = db.prepare(`
            UPDATE ai_models 
            SET total_analyses = total_analyses + 1,
                success_count = success_count + ?,
                error_count = error_count + ?,
                total_tokens = total_tokens + ?,
                total_cost = total_cost + ?,
                avg_quality_score = ((avg_quality_score * total_analyses) + ?) / (total_analyses + 1),
                avg_response_time = ((avg_response_time * total_analyses) + ?) / (total_analyses + 1),
                last_used_at = CURRENT_TIMESTAMP,
                last_error = CASE WHEN ? = 0 THEN ? ELSE last_error END
            WHERE model_id = ?
        `);
        
        return stmt.run(
            success ? 1 : 0,
            success ? 0 : 1,
            tokens || 0,
            cost || 0,
            quality || 0,
            responseTime || 0,
            success ? 1 : 0,
            success ? null : 'Analysis failed',
            modelId
        );
    },

    createAIModel(modelData) {
        const stmt = db.prepare(`
            INSERT INTO ai_models (
                model_id, provider, model_name, status, 
                input_cost, output_cost, api_endpoint,
                parameters, env_var, model_type, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            modelData.model_id,
            modelData.provider,
            modelData.model_name,
            modelData.status || 'inactive',
            modelData.input_cost,
            modelData.output_cost,
            modelData.api_endpoint,
            modelData.parameters || '{}',
            modelData.env_var,
            modelData.model_type,
            modelData.notes || null
        );
    },

    updateAIModel(modelId, modelData) {
        const stmt = db.prepare(`
            UPDATE ai_models 
            SET provider = ?, model_name = ?, status = ?, 
                input_cost = ?, output_cost = ?, api_endpoint = ?,
                parameters = ?, env_var = ?, model_type = ?, notes = ?
            WHERE model_id = ?
        `);
        
        return stmt.run(
            modelData.provider,
            modelData.model_name,
            modelData.status,
            modelData.input_cost,
            modelData.output_cost,
            modelData.api_endpoint,
            modelData.parameters || '{}',
            modelData.env_var,
            modelData.model_type,
            modelData.notes || null,
            modelId
        );
    },

    deleteAIModel(modelId) {
        return db.prepare('DELETE FROM ai_models WHERE model_id = ?').run(modelId);
    },

    getAIModelById(id) {
        return db.prepare('SELECT * FROM ai_models WHERE id = ?').get(id);
    },

    // Encryption utilities
    getEncryptionKey() {
        // Use environment variable or generate one (store securely in production)
        return process.env.ENCRYPTION_KEY || 'commit-analyzer-default-key-change-in-production-32chars';
    },

    encryptApiKey(plainKey) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipher(algorithm, key, iv);
            
            let encrypted = cipher.update(plainKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Combine iv + encrypted data
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt API key');
        }
    },

    decryptApiKey(encryptedKey) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
            
            const parts = encryptedKey.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted key format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            
            const decipher = crypto.createDecipher(algorithm, key, iv);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt API key');
        }
    },

    // Encrypted API Keys management
    saveEncryptedApiKey(keyName, plainKey, provider, userId = null, isGlobal = true) {
        try {
            const encryptedKey = this.encryptApiKey(plainKey);
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO encrypted_api_keys 
                (key_name, encrypted_key, provider, user_id, is_global, key_version)
                VALUES (?, ?, ?, ?, ?, 
                    COALESCE((SELECT key_version + 1 FROM encrypted_api_keys 
                             WHERE key_name = ? AND user_id IS ? AND is_global = ?), 1))
            `);
            
            return stmt.run(keyName, encryptedKey, provider, userId, isGlobal ? 1 : 0, 
                           keyName, userId, isGlobal ? 1 : 0);
        } catch (error) {
            console.error('Error saving encrypted API key:', error);
            throw error;
        }
    },

    getDecryptedApiKey(keyName, userId = null, isGlobal = true) {
        try {
            const stmt = db.prepare(`
                SELECT encrypted_key, provider, last_used_at 
                FROM encrypted_api_keys 
                WHERE key_name = ? AND user_id IS ? AND is_global = ?
                ORDER BY key_version DESC 
                LIMIT 1
            `);
            
            const result = stmt.get(keyName, userId, isGlobal ? 1 : 0);
            
            if (!result) {
                return null;
            }
            
            // Update last used timestamp
            this.updateApiKeyLastUsed(keyName, userId, isGlobal);
            
            return {
                key: this.decryptApiKey(result.encrypted_key),
                provider: result.provider,
                lastUsed: result.last_used_at
            };
        } catch (error) {
            console.error('Error retrieving decrypted API key:', error);
            return null;
        }
    },

    updateApiKeyLastUsed(keyName, userId = null, isGlobal = true) {
        const stmt = db.prepare(`
            UPDATE encrypted_api_keys 
            SET last_used_at = CURRENT_TIMESTAMP 
            WHERE key_name = ? AND user_id IS ? AND is_global = ?
        `);
        return stmt.run(keyName, userId, isGlobal ? 1 : 0);
    },

    getAllApiKeys(userId = null, isGlobal = true) {
        const stmt = db.prepare(`
            SELECT key_name, provider, last_used_at, key_version, created_at
            FROM encrypted_api_keys 
            WHERE user_id IS ? AND is_global = ?
            ORDER BY provider, key_name
        `);
        
        return stmt.all(userId, isGlobal ? 1 : 0);
    },

    deleteApiKey(keyName, userId = null, isGlobal = true) {
        const stmt = db.prepare(`
            DELETE FROM encrypted_api_keys 
            WHERE key_name = ? AND user_id IS ? AND is_global = ?
        `);
        return stmt.run(keyName, userId, isGlobal ? 1 : 0);
    },

    // Helper to get API key for AI model operations
    getApiKeyForModel(modelId) {
        const model = this.getAIModel(modelId);
        if (!model) return null;
        
        // Try to get the API key using the model's env_var name
        return this.getDecryptedApiKey(model.env_var);
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