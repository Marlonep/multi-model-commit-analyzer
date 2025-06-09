import { dbHelpers } from './database.js';

console.log('Creating Nuclea Solutions organization...');

try {
    // Check if organization already exists
    let org = dbHelpers.getOrganizationByName('Nuclea-Solutions');
    
    if (!org) {
        // Create the organization
        const result = dbHelpers.createOrganization({
            name: 'Nuclea-Solutions',
            slug: 'nuclea-solutions',
            display_name: 'Nuclea Solutions',
            description: 'Software development company specializing in AI-powered solutions',
            website: 'https://nucleasolutions.com',
            github_url: 'https://github.com/Nuclea-Solutions',
            location: 'Remote',
            industry: 'Software Development',
            size_category: 'Small',
            primary_language: 'JavaScript',
            tech_stack: ['Node.js', 'React', 'SQLite', 'AI/ML'],
            contact_email: 'info@nucleasolutions.com',
            is_active: true
        });
        
        console.log('✅ Organization created successfully!');
        org = dbHelpers.getOrganizationById(result.lastInsertRowid);
    } else {
        console.log('ℹ️  Organization already exists');
    }
    
    // Add all existing users as members
    const users = dbHelpers.getAllUsers();
    console.log(`\nAdding ${users.length} users to the organization...`);
    
    for (const user of users) {
        try {
            // Check if user is already a member
            const members = dbHelpers.getOrganizationMembers(org.id);
            const isMember = members.some(m => m.id === user.id);
            
            if (!isMember) {
                dbHelpers.addUserToOrganization(user.id, org.id, 'Developer', 'Engineering');
                console.log(`✅ Added ${user.username} to organization`);
            } else {
                console.log(`ℹ️  ${user.username} is already a member`);
            }
        } catch (error) {
            console.log(`⚠️  Error adding ${user.username}: ${error.message}`);
        }
    }
    
    // Show organization stats
    const commits = dbHelpers.getCommitsByOrganizationId(org.id);
    const members = dbHelpers.getOrganizationMembers(org.id);
    
    console.log('\nOrganization Summary:');
    console.log('====================');
    console.log(`Name: ${org.display_name}`);
    console.log(`Members: ${members.length}`);
    console.log(`Commits: ${commits.length}`);
    console.log(`Website: ${org.website}`);
    console.log(`GitHub: ${org.github_url}`);
    
} catch (error) {
    console.error('Error creating organization:', error);
}

process.exit(0);