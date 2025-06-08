import { dbHelpers } from './database.js';

console.log('📊 DATABASE VIEWER\n');

// View Users
console.log('👥 USERS TABLE:');
console.log('─'.repeat(80));
const users = dbHelpers.getAllUsers();
console.table(users.map(u => ({
    ID: u.id,
    Username: u.username,
    Name: u.name,
    Role: u.role,
    Status: u.status,
    Created: new Date(u.created_at).toLocaleDateString()
})));

// View Commits Summary
console.log('\n📝 COMMITS SUMMARY:');
console.log('─'.repeat(80));
const commits = dbHelpers.getAllCommits('admin', 1, 'admin');
const commitsByUser = {};
commits.forEach(c => {
    if (!commitsByUser[c.user_name]) {
        commitsByUser[c.user_name] = {
            count: 0,
            lines_added: 0,
            lines_deleted: 0,
            total_cost: 0
        };
    }
    commitsByUser[c.user_name].count++;
    commitsByUser[c.user_name].lines_added += c.lines_added;
    commitsByUser[c.user_name].lines_deleted += c.lines_deleted;
    commitsByUser[c.user_name].total_cost += c.total_cost;
});

console.table(Object.entries(commitsByUser).map(([user, stats]) => ({
    User: user,
    Commits: stats.count,
    'Lines Added': stats.lines_added.toLocaleString(),
    'Lines Deleted': stats.lines_deleted.toLocaleString(),
    'Total Cost': `$${stats.total_cost.toFixed(2)}`
})));

// View Recent Commits
console.log('\n🕐 RECENT COMMITS (Last 5):');
console.log('─'.repeat(80));
const recentCommits = commits.slice(0, 5);
console.table(recentCommits.map(c => ({
    Hash: c.commit_hash.substring(0, 8),
    User: c.user_name,
    Message: c.commit_message.substring(0, 50) + '...',
    Date: new Date(c.timestamp).toLocaleString(),
    Status: c.status
})));

// View User Details
console.log('\n📧 USER DETAILS:');
console.log('─'.repeat(80));
users.forEach(user => {
    const details = dbHelpers.getUserDetails(user.id);
    if (details) {
        console.log(`${user.name}: Email: ${details.email || 'Not set'}, Phone: ${details.phone || 'Not set'}`);
    }
});

console.log('\n✅ Database view complete!');
console.log(`📁 Database file: commit_analyzer.db (${(393216 / 1024).toFixed(1)} KB)`);