// Organization API endpoints to add to server.js

// Get all organizations
app.get('/api/organizations', async (req, res) => {
  try {
    const organizations = dbHelpers.getAllOrganizations();
    
    // Add statistics for each organization
    const orgsWithStats = organizations.map(org => {
      const commits = dbHelpers.getCommitsByOrganizationId(org.id);
      const members = dbHelpers.getOrganizationMembers(org.id);
      
      return {
        ...org,
        stats: {
          totalCommits: commits.length,
          totalMembers: members.length,
          averageQuality: commits.length > 0 ? 
            commits.reduce((sum, c) => sum + c.average_code_quality, 0) / commits.length : 0,
          totalLinesAdded: commits.reduce((sum, c) => sum + (c.lines_added || 0), 0),
          totalLinesDeleted: commits.reduce((sum, c) => sum + (c.lines_deleted || 0), 0)
        }
      };
    });
    
    res.json(orgsWithStats);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get organization by ID or slug
app.get('/api/organizations/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let organization = dbHelpers.getOrganizationById(parseInt(identifier));
    if (!organization) {
      organization = dbHelpers.getOrganizationBySlug(identifier);
    }
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Get additional data
    const members = dbHelpers.getOrganizationMembers(organization.id);
    const commits = dbHelpers.getCommitsByOrganizationId(organization.id);
    
    // Parse tech_stack JSON
    if (organization.tech_stack) {
      try {
        organization.tech_stack = JSON.parse(organization.tech_stack);
      } catch (e) {
        organization.tech_stack = [];
      }
    }
    
    res.json({
      ...organization,
      members,
      stats: {
        totalCommits: commits.length,
        totalMembers: members.length,
        averageQuality: commits.length > 0 ? 
          commits.reduce((sum, c) => sum + c.average_code_quality, 0) / commits.length : 0,
        totalLinesAdded: commits.reduce((sum, c) => sum + (c.lines_added || 0), 0),
        totalLinesDeleted: commits.reduce((sum, c) => sum + (c.lines_deleted || 0), 0),
        recentCommits: commits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Create new organization (admin only)
app.post('/api/organizations', requireAdmin, async (req, res) => {
  try {
    const orgData = req.body;
    
    // Validate required fields
    if (!orgData.name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    
    // Generate slug if not provided
    if (!orgData.slug) {
      orgData.slug = orgData.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    
    // Check if organization already exists
    const existing = dbHelpers.getOrganizationByName(orgData.name) || 
                    dbHelpers.getOrganizationBySlug(orgData.slug);
    if (existing) {
      return res.status(400).json({ error: 'Organization already exists' });
    }
    
    const result = dbHelpers.createOrganization(orgData);
    const newOrg = dbHelpers.getOrganizationById(result.lastInsertRowid);
    
    res.json({ success: true, organization: newOrg });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Update organization (admin only)
app.put('/api/organizations/:id', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const orgData = req.body;
    
    // Check if organization exists
    const existing = dbHelpers.getOrganizationById(orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const result = dbHelpers.updateOrganization(orgId, orgData);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'No changes made' });
    }
    
    const updatedOrg = dbHelpers.getOrganizationById(orgId);
    res.json({ success: true, organization: updatedOrg });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Delete organization (admin only)
app.delete('/api/organizations/:id', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    
    // Check if organization exists
    const existing = dbHelpers.getOrganizationById(orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Soft delete
    const result = dbHelpers.deleteOrganization(orgId);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete organization' });
    }
    
    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// User organization membership endpoints

// Add user to organization
app.post('/api/organizations/:id/members', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const { userId, role, department } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = dbHelpers.addUserToOrganization(userId, orgId, role, department);
    res.json({ success: true, message: 'User added to organization' });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    res.status(500).json({ error: 'Failed to add user to organization' });
  }
});

// Remove user from organization
app.delete('/api/organizations/:id/members/:userId', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    const result = dbHelpers.removeUserFromOrganization(userId, orgId);
    res.json({ success: true, message: 'User removed from organization' });
  } catch (error) {
    console.error('Error removing user from organization:', error);
    res.status(500).json({ error: 'Failed to remove user from organization' });
  }
});

// Get user's organizations
app.get('/api/users/:userId/organizations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const organizations = dbHelpers.getUserOrganizations(userId);
    res.json(organizations);
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch user organizations' });
  }
});