import Database from 'better-sqlite3';

const db = new Database('./commit_analyzer.db');

console.log('=== Organizations Table ===');
const orgs = db.prepare('SELECT * FROM organizations').all();
console.log(JSON.stringify(orgs, null, 2));

console.log('\n=== User Organizations Table ===');
const userOrgs = db.prepare('SELECT * FROM user_organizations').all();
console.log(JSON.stringify(userOrgs, null, 2));

console.log('\n=== Commits with organization_id (first 5) ===');
const commits = db.prepare('SELECT commit_hash, organization, organization_id FROM commits LIMIT 5').all();
console.log(JSON.stringify(commits, null, 2));

console.log('\n=== Table Schema Check ===');
console.log('Organizations table exists:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'").get());
console.log('User_organizations table exists:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_organizations'").get());

const columnsCheck = db.prepare("PRAGMA table_info(commits)").all();
console.log('\nCommits table has organization_id column:', columnsCheck.some(col => col.name === 'organization_id'));

db.close();