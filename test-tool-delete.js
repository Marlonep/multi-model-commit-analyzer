import fetch from 'node-fetch';

async function testToolDelete() {
    try {
        // Login first
        console.log('Logging in...');
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
        
        const loginData = await loginResponse.json();
        console.log('Login status:', loginResponse.status);
        
        if (loginData.token) {
            const token = loginData.token;
            
            // First, create a test tool to delete
            console.log('\nCreating a test tool...');
            const createData = {
                id: 'test_tool_delete',
                name: 'Test Tool for Deletion',
                category: 'Testing',
                description: 'This tool is created for deletion testing',
                price: '$0',
                costPerMonth: 0,
                website: 'https://example.com',
                image: 'https://example.com/icon.png'
            };
            
            const createResponse = await fetch('http://localhost:3000/api/tools', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(createData)
            });
            
            console.log('Create response status:', createResponse.status);
            const createResult = await createResponse.json();
            console.log('Create result:', createResult);
            
            if (createResponse.status === 200 || createResponse.status === 201) {
                // Get all tools to find our newly created tool with its dbId
                console.log('\nFinding the created tool...');
                const toolsResponse = await fetch('http://localhost:3000/api/tools', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const toolsData = await toolsResponse.json();
                const testTool = toolsData.tools.find(t => t.id === 'test_tool_delete');
                
                if (testTool) {
                    console.log('Test tool found:', {
                        id: testTool.id,
                        dbId: testTool.dbId,
                        name: testTool.name
                    });
                    
                    // Now test deleting the tool
                    console.log('\nTesting tool deletion...');
                    const deleteResponse = await fetch(`http://localhost:3000/api/tools/${testTool.dbId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    console.log('Delete response status:', deleteResponse.status);
                    const deleteResult = await deleteResponse.json();
                    console.log('Delete result:', deleteResult);
                    
                    if (deleteResponse.status === 200) {
                        console.log('✅ Tool deletion successful!');
                        
                        // Verify deletion by trying to find the tool again
                        console.log('\nVerifying deletion...');
                        const verifyResponse = await fetch('http://localhost:3000/api/tools', {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        const verifyData = await verifyResponse.json();
                        const deletedTool = verifyData.tools.find(t => t.dbId === testTool.dbId);
                        
                        if (!deletedTool) {
                            console.log('✅ Deletion verification successful! Tool no longer exists.');
                        } else {
                            console.log('❌ Deletion verification failed - tool still exists');
                        }
                    } else {
                        console.log('❌ Tool deletion failed');
                    }
                } else {
                    console.log('❌ Could not find the test tool that was created');
                }
            } else {
                console.log('❌ Failed to create test tool');
            }
        }
        
    } catch (error) {
        console.error('Error testing tool delete:', error);
    }
}

testToolDelete();