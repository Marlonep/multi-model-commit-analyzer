import Database from 'better-sqlite3';
import { dbHelpers } from './database.js';

console.log('🧪 Testing Organization API and Database Functions...\n');

// Test 1: Get all organizations
console.log('1. Testing getAllOrganizations()');
const orgs = dbHelpers.getAllOrganizations();
console.log(`   Found ${orgs.length} organizations:`, orgs.map(o => o.name));

// Test 2: Get organization by name
console.log('\n2. Testing getOrganizationByName()');
const nuclea = dbHelpers.getOrganizationByName('Nuclea-Solutions');
console.log(`   Nuclea-Solutions org:`, nuclea ? `Found (ID: ${nuclea.id})` : 'Not found');

// Test 3: Get commits by organization
console.log('\n3. Testing getCommitsByOrganizationId()');
if (nuclea) {
    const commits = dbHelpers.getCommitsByOrganizationId(nuclea.id);
    console.log(`   Commits for Nuclea-Solutions: ${commits.length}`);
    console.log(`   Sample commit: ${commits[0]?.commit_hash?.substring(0, 8) || 'None'}`);
}

// Test 4: Test find or create organization
console.log('\n4. Testing findOrCreateOrganization()');
const testOrg = dbHelpers.findOrCreateOrganization('Test-Organization');
console.log(`   Test organization: ${testOrg ? `Created/Found (ID: ${testOrg.id})` : 'Failed'}`);

// Test 5: Create a new organization with full data
console.log('\n5. Testing createOrganization() with rich data');
try {
    const richOrgData = {
        name: 'Example Corp',
        slug: 'example-corp',
        display_name: 'Example Corporation',
        description: 'A sample organization for testing',
        website: 'https://example.com',
        github_url: 'https://github.com/example-corp',
        location: 'San Francisco, CA',
        industry: 'Technology',
        size_category: 'medium',
        founded_date: '2020-01-01',
        timezone: 'America/Los_Angeles',
        primary_language: 'JavaScript',
        tech_stack: ['React', 'Node.js', 'PostgreSQL'],
        contact_email: 'contact@example.com',
        contact_phone: '+1-555-0123'
    };
    
    const result = dbHelpers.createOrganization(richOrgData);
    const newOrg = dbHelpers.getOrganizationById(result.lastInsertRowid);
    console.log(`   Rich organization created: ${newOrg.name} (ID: ${newOrg.id})`);
    console.log(`   Tech stack: ${JSON.parse(newOrg.tech_stack || '[]').join(', ')}`);
} catch (error) {
    console.log(`   Error: ${error.message}`);
}

// Test 6: Test user-organization relationships
console.log('\n6. Testing user-organization relationships');
try {
    // Get a user first
    const users = dbHelpers.getAllUsers();
    if (users.length > 0) {
        const testUser = users[0];
        console.log(`   Testing with user: ${testUser.username} (ID: ${testUser.id})`);
        
        // Add user to organization
        if (nuclea) {
            const addResult = dbHelpers.addUserToOrganization(testUser.id, nuclea.id, 'Developer', 'Engineering');
            console.log(`   Added user to Nuclea-Solutions: ${addResult.changes > 0 ? 'Success' : 'Failed'}`);
            
            // Get user's organizations
            const userOrgs = dbHelpers.getUserOrganizations(testUser.id);
            console.log(`   User's organizations: ${userOrgs.map(o => o.name).join(', ')}`);
            
            // Get organization members
            const members = dbHelpers.getOrganizationMembers(nuclea.id);
            console.log(`   Nuclea-Solutions members: ${members.length}`);
        }
    }
} catch (error) {
    console.log(`   Error: ${error.message}`);
}

// Test 7: Database statistics
console.log('\n7. Database Statistics');
const db = new Database('./commit_analyzer.db');
const stats = {
    organizations: db.prepare('SELECT COUNT(*) as count FROM organizations WHERE is_active = 1').get().count,
    userOrganizations: db.prepare('SELECT COUNT(*) as count FROM user_organizations WHERE is_active = 1').get().count,
    commitsWithOrgId: db.prepare('SELECT COUNT(*) as count FROM commits WHERE organization_id IS NOT NULL').get().count,
    totalCommits: db.prepare('SELECT COUNT(*) as count FROM commits').get().count
};
db.close();

console.log(`   Active organizations: ${stats.organizations}`);
console.log(`   User-organization relationships: ${stats.userOrganizations}`);
console.log(`   Commits with organization_id: ${stats.commitsWithOrgId}/${stats.totalCommits}`);

console.log('\n✅ Organization migration testing completed!');
console.log('\n📊 Next steps:');
console.log('   1. Test the web interface at http://localhost:3000/analytics.html');
console.log('   2. Test API endpoints with proper authentication');
console.log('   3. Add more organization data through the admin interface');
console.log('   4. Verify organization analytics and reporting');