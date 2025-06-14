import { dbHelpers, db } from "../database/db.js";
import { requireAdmin } from "../api/middleware/auth.middleware.js";
import { Router } from "../api/middleware/router.js";

/**
 * @param {Router} router
*/
export function setupGit(router) {
    router.group({ middleware: [requireAdmin] }, () => {
        router.get('/api/git/organizations', async (req, res) => {
            try {
                // Get all organizations IDs first
                const orgIds = db.prepare('SELECT id FROM organizations ORDER BY name ASC').all();

                // Get each organization with its repositories
                const organizationsWithRepos = orgIds.map(({ id }) => {
                    const orgWithRepos = dbHelpers.getOrganizationWithRepositories(id);

                    if (!orgWithRepos) return null;

                    // Get encrypted key information if available
                    let tokenSuffix = null;
                    if (orgWithRepos.encrypted_api_key_id) {
                        const encryptedKeys = dbHelpers.getAllApiKeys();
                        const encryptedKey = encryptedKeys.find(key => key.id === orgWithRepos.encrypted_api_key_id);
                        if (encryptedKey) {
                            tokenSuffix = encryptedKey.key_name ?
                                encryptedKey.key_name.slice(-4) :
                                '••••';
                        }
                    }

                    return {
                        id: orgWithRepos.id,
                        name: orgWithRepos.name,
                        provider: orgWithRepos.provider,
                        provider_id: orgWithRepos.provider_id,
                        user_id: orgWithRepos.user_id,
                        encrypted_api_key_id: orgWithRepos.encrypted_api_key_id,
                        created_at: orgWithRepos.created_at,
                        updated_at: orgWithRepos.updated_at,
                        token_suffix: tokenSuffix,
                        webhook_active: true, // TODO: Implement webhook status tracking
                        repositories: orgWithRepos.repositories.map(repo => ({
                            id: repo.id,
                            name: repo.name,
                            description: repo.description,
                            provider_id: repo.provider_id,
                            enabled: repo.enabled,
                            organization_id: repo.organization_id,
                            full_name: `${orgWithRepos.name}/${repo.name}`,
                            commits_analyzed: 0, // TODO: Implement commit count tracking
                            last_sync: null, // TODO: Implement sync tracking
                            active: repo.enabled
                        }))
                    };
                }).filter(org => org !== null);

                res.json({
                    success: true,
                    organizations: organizationsWithRepos,
                    total_organizations: organizationsWithRepos.length,
                    total_repositories: organizationsWithRepos.reduce((sum, org) => sum + org.repositories.length, 0)
                });
            } catch (error) {
                console.error('Error fetching Git organizations:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch Git organizations'
                });
            }
        });
    });
}
