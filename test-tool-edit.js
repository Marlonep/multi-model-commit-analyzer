import fetch from 'node-fetch';

async function testToolEdit() {
    try {
        // Login first
        console.log('Logging in...');
        const loginResponse = await fetch('http://localhost:3000/api/tools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login status:', loginResponse.status);
        
        if (loginResponse.status === 401) {
            // Try login endpoint
            const loginResponse2 = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'admin'
                })
            });
            
            const loginData2 = await loginResponse2.json();
            console.log('Login2 status:', loginResponse2.status);
            
            if (loginData2.token) {
                const token = loginData2.token;
                
                // Get all tools first
                console.log('\nGetting all tools...');
                const toolsResponse = await fetch('http://localhost:3000/api/tools', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const toolsData = await toolsResponse.json();
                console.log('Tools retrieved:', toolsData.tools.length);
                
                // Find a tool to edit (use the first one)
                const toolToEdit = toolsData.tools[0];
                console.log('Tool to edit:', {
                    id: toolToEdit.id,
                    dbId: toolToEdit.dbId,
                    name: toolToEdit.name
                });
                
                // Test editing the tool
                console.log('\nTesting tool edit...');
                const editData = {
                    ...toolToEdit,
                    description: `${toolToEdit.description} [EDITED at ${new Date().toISOString()}]`
                };
                
                const editResponse = await fetch(`http://localhost:3000/api/tools/${toolToEdit.dbId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(editData)
                });
                
                console.log('Edit response status:', editResponse.status);
                const editResult = await editResponse.json();
                console.log('Edit result:', editResult);
                
                if (editResponse.status === 200) {
                    console.log('✅ Tool edit successful!');
                    
                    // Verify the edit by fetching the tool again
                    console.log('\nVerifying edit...');
                    const verifyResponse = await fetch('http://localhost:3000/api/tools', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const verifyData = await verifyResponse.json();
                    const editedTool = verifyData.tools.find(t => t.dbId === toolToEdit.dbId);
                    
                    if (editedTool && editedTool.description.includes('[EDITED')) {
                        console.log('✅ Edit verification successful!');
                        console.log('Updated description:', editedTool.description);
                    } else {
                        console.log('❌ Edit verification failed');
                    }
                } else {
                    console.log('❌ Tool edit failed');
                }
            }
        }
        
    } catch (error) {
        console.error('Error testing tool edit:', error);
    }
}

testToolEdit();