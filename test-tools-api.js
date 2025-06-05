import fetch from 'node-fetch';

async function testToolsAPI() {
    try {
        // First, try to get tools without auth (should fail)
        console.log('Testing tools API without authentication...');
        const unauthedResponse = await fetch('http://localhost:3000/api/tools');
        console.log('Unauth status:', unauthedResponse.status);
        const unauthedData = await unauthedResponse.json();
        console.log('Unauth response:', unauthedData);
        
        // Try to login as admin first
        console.log('\nAttempting to login as admin...');
        const loginResponse = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin'
            })
        });
        
        console.log('Login status:', loginResponse.status);
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (loginData.token) {
            // Now test the tools API with authentication
            console.log('\nTesting tools API with authentication...');
            const toolsResponse = await fetch('http://localhost:3000/api/tools', {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`
                }
            });
            
            console.log('Tools API status:', toolsResponse.status);
            const toolsData = await toolsResponse.json();
            console.log('Tools data structure:');
            if (toolsData.tools && toolsData.tools.length > 0) {
                console.log('First tool:', JSON.stringify(toolsData.tools[0], null, 2));
                console.log('Total tools:', toolsData.tools.length);
                
                // Check if dbId is present
                const firstTool = toolsData.tools[0];
                if (firstTool.dbId) {
                    console.log(`✅ dbId is present: ${firstTool.dbId}`);
                } else {
                    console.log('❌ dbId is missing!');
                }
            }
        }
        
    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testToolsAPI();