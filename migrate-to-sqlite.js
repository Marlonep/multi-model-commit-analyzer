import fs from 'fs/promises';
import { dbHelpers } from './database.js';

async function migrateToSQLite() {
    console.log('🚀 Starting migration to SQLite...\n');

    try {
        // Step 1: Migrate users from users.json
        await migrateUsers();
        
        // Step 2: Migrate user details from user-details.json
        await migrateUserDetails();
        
        // Step 3: Migrate commits from commit_analysis_history.json
        await migrateCommits();
        
        // Step 4: Migrate daily commits from daily-commits.json (if exists)
        await migrateDailyCommits();
        
        // Step 5: Migrate tools from tools-data.json
        await migrateTools();
        
        console.log('✅ Migration completed successfully!');
        console.log('📁 Database file created: commit_analyzer.db');
        console.log('🔗 You can now start the server with: npm start');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

async function migrateUsers() {
    console.log('📥 Migrating users...');
    
    try {
        const usersData = await fs.readFile('./users.json', 'utf8');
        const users = JSON.parse(usersData);
        
        console.log(`Found ${users.length} users to migrate`);
        
        for (const user of users) {
            try {
                // Skip admin user as it's already created by default
                if (user.username === 'admin') {
                    console.log(`ℹ️  Skipping admin user (already exists)`);
                    continue;
                }
                
                const result = dbHelpers.createUser({
                    username: user.username,
                    password_hash: user.password,
                    name: user.name,
                    role: user.role,
                    status: user.status || 'active'
                });
                
                console.log(`✓ Migrated user: ${user.username} (ID: ${result.lastInsertRowid})`);
                
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    console.log(`ℹ️  User ${user.username} already exists, skipping`);
                } else {
                    console.error(`Error migrating user ${user.username}:`, error.message);
                }
            }
        }
        
        console.log('✅ Users migration completed\n');
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No users.json file found, skipping users migration\n');
        } else {
            throw error;
        }
    }
}

async function migrateUserDetails() {
    console.log('📥 Migrating user details...');
    
    try {
        const userDetailsData = await fs.readFile('./user-details.json', 'utf8');
        const userDetails = JSON.parse(userDetailsData);
        
        const detailsToMigrate = Object.entries(userDetails);
        console.log(`Found ${detailsToMigrate.length} user detail records to migrate`);
        
        for (const [userKey, details] of detailsToMigrate) {
            try {
                // Try to find user by username first, then by name
                let user = dbHelpers.getUserByUsername(userKey);
                if (!user) {
                    // Try to find by name (for existing data compatibility)
                    const allUsers = dbHelpers.getAllUsers();
                    user = allUsers.find(u => u.name === userKey);
                }
                
                if (!user) {
                    console.log(`⚠️  No user found for key: ${userKey}, skipping`);
                    continue;
                }
                
                const result = dbHelpers.createOrUpdateUserDetails(user.id, {
                    email: details.email || '',
                    phone: details.phone || '',
                    whatsapp_available: details.whatsappAvailable || false,
                    min_hours_per_day: details.minHoursPerDay || 8,
                    organizations: details.organizations || [],
                    tools: details.tools || []
                });
                
                console.log(`✓ Migrated details for: ${userKey} (User ID: ${user.id})`);
                
            } catch (error) {
                console.error(`Error migrating details for ${userKey}:`, error.message);
            }
        }
        
        console.log('✅ User details migration completed\n');
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No user-details.json file found, skipping user details migration\n');
        } else {
            throw error;
        }
    }
}

async function migrateCommits() {
    console.log('📥 Migrating commits...');
    
    try {
        const commitsData = await fs.readFile('./commit_analysis_history.json', 'utf8');
        const commits = JSON.parse(commitsData);
        
        console.log(`Found ${commits.length} commits to migrate`);
        
        // Process commits in batches to show progress
        const batchSize = 100;
        let migratedCount = 0;
        
        for (let i = 0; i < commits.length; i += batchSize) {
            const batch = commits.slice(i, i + batchSize);
            
            for (const commit of batch) {
                try {
                    const result = dbHelpers.createCommit({
                        commit_hash: commit.commitHash,
                        user_name: commit.user || commit.author || 'unknown',
                        project: commit.project,
                        organization: commit.organization,
                        commit_message: commit.commitMessage,
                        timestamp: commit.timestamp,
                        file_changes: commit.fileChanges || 0,
                        lines_added: commit.linesAdded || 0,
                        lines_deleted: commit.linesDeleted || 0,
                        average_code_quality: commit.averageCodeQuality || 0,
                        average_dev_level: commit.averageDevLevel || 0,
                        average_complexity: commit.averageComplexity || 0,
                        average_estimated_hours: commit.averageEstimatedHours || 0,
                        average_estimated_hours_with_ai: commit.averageEstimatedHoursWithAi || 0,
                        average_ai_percentage: commit.averageAiPercentage || 0,
                        total_cost: commit.totalCost || 0,
                        tokens_used: commit.tokensUsed || 0,
                        status: commit.status || 'ok',
                        manually_reviewed: commit.manuallyReviewed || false,
                        status_log: commit.statusLog || [],
                        analysis_details: {
                            fileAnalyses: commit.fileAnalyses || [],
                            originalData: commit // Store original data for reference
                        }
                    });
                    
                    migratedCount++;
                    
                } catch (error) {
                    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        console.log(`ℹ️  Commit ${commit.commitHash} already exists, skipping`);
                    } else {
                        console.error(`Error migrating commit ${commit.commitHash}:`, error.message);
                    }
                }
            }
            
            console.log(`✓ Migrated commits ${Math.min(i + batchSize, commits.length)}/${commits.length}`);
        }
        
        console.log(`✅ Commits migration completed (${migratedCount} commits migrated)\n`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No commit_analysis_history.json file found, skipping commits migration\n');
        } else {
            throw error;
        }
    }
}

async function migrateDailyCommits() {
    console.log('📥 Migrating daily commits...');
    
    try {
        const dailyCommitsData = await fs.readFile('./daily-commits.json', 'utf8');
        const dailyCommits = JSON.parse(dailyCommitsData);
        
        if (!dailyCommits.dailyCommits || !Array.isArray(dailyCommits.dailyCommits)) {
            console.log('ℹ️  No daily commits data found, skipping\n');
            return;
        }
        
        console.log(`Found ${dailyCommits.dailyCommits.length} daily commit records to migrate`);
        
        let migratedCount = 0;
        
        for (const daily of dailyCommits.dailyCommits) {
            try {
                const result = dbHelpers.createOrUpdateDailyCommit({
                    date: daily.date,
                    user_name: daily.user || 'unknown',
                    total_commits: daily.totalCommits || 0,
                    total_lines_added: daily.totalLinesAdded || 0,
                    total_lines_deleted: daily.totalLinesDeleted || 0,
                    total_hours: daily.totalHours || 0,
                    average_quality: daily.averageQuality || 0,
                    average_complexity: daily.averageComplexity || 0,
                    summary: daily.summary || ''
                });
                
                migratedCount++;
                
            } catch (error) {
                console.error(`Error migrating daily commit for ${daily.user} on ${daily.date}:`, error.message);
            }
        }
        
        console.log(`✅ Daily commits migration completed (${migratedCount} records migrated)\n`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No daily-commits.json file found, skipping daily commits migration\n');
        } else {
            throw error;
        }
    }
}

async function migrateTools() {
    console.log('📥 Migrating tools...');
    
    try {
        const toolsData = await fs.readFile('./tools-data.json', 'utf8');
        const { tools } = JSON.parse(toolsData);
        
        console.log(`Found ${tools.length} tools to migrate`);
        
        let migratedCount = 0;
        
        for (const tool of tools) {
            try {
                const result = dbHelpers.createTool({
                    tool_id: tool.id,
                    image: tool.image,
                    name: tool.name,
                    category: tool.category,
                    description: tool.description,
                    price: tool.price,
                    cost_per_month: tool.costPerMonth,
                    website: tool.website
                }, 1); // Created by admin user
                
                migratedCount++;
                console.log(`✓ Migrated tool: ${tool.name}`);
                
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    console.log(`ℹ️  Tool ${tool.name} already exists, skipping`);
                } else {
                    console.error(`Error migrating tool ${tool.name}:`, error.message);
                }
            }
        }
        
        console.log(`✅ Tools migration completed (${migratedCount} tools migrated)\n`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No tools-data.json file found, skipping tools migration\n');
        } else {
            throw error;
        }
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToSQLite();
}

export { migrateToSQLite };