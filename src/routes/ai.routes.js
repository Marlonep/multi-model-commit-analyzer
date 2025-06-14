import { Router } from "../api/middleware/router.js";
import { requireAdmin } from "../api/middleware/auth.middleware.js";
import { AIModels } from "../analyzers/commitAnalyzer.js";
import { startAnalisisSchema } from "../validations/keys.js";
import { dbHelpers } from "../database/db.js";
import { ScanService } from "../services/scan.service.js";
import { logger } from "../logger.js";
import Joi from "joi";

/**
 * @param {Router} router
*/
export function setupAi(router) {
    router.group({ middleware: [requireAdmin] }, () => {
        // API endpoint to test AI models using encrypted database keys
        router.post('/api/ai/test', async (req, res) => {
            try {
                const { modelIds } = req.body;
                const aiModels = new AIModels();

                const results = [];
                const testModels = modelIds ?
                    aiModels.models.filter(m => modelIds.includes(m.type)) :
                    aiModels.models;

                for (const model of testModels) {
                    try {
                        const startTime = Date.now();

                        // Simple test prompt
                        const testPrompt = "Respond with 'OK' if you can process this message.";
                        const result = await aiModels.getModelResponse(model, testPrompt);
                        const responseTime = (Date.now() - startTime) / 1000;

                        results.push({
                            modelType: model.model_type,
                            modelName: model.model_name,
                            status: testResult ? 'active' : 'error',
                            responseTime: responseTime.toFixed(2),
                            error: testResult ? null : `Unexpected response: ${rawResponse.substring(0, 100)}`,
                            cost: 0.001, // Minimal estimated cost for test
                            tokens: 10 // Minimal estimated tokens for test
                        });

                    } catch (error) {
                        results.push({
                            modelType: model.model_type,
                            modelName: model.model_name,
                            status: 'error',
                            responseTime: 0,
                            error: error.message,
                            cost: 0,
                            tokens: 0
                        });
                    }
                }

                res.json({ results });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        })

        router.post('/api/start-analysis', async (req, res) => {
            try {
                await startAnalisisSchema.validateAsync(req.body);

                const data = req.body;
                // validate organization and repository exists
                const org = dbHelpers.getOrganizationById(data.organization_id);
                if (!org) {
                    res.status(404).json({ error: 'Organization not found' });
                    return;
                }

                const rep = dbHelpers.getGitRepositoryById(data.repository_id);
                if (!rep) {
                    res.status(404).json({ error: 'Repository not found' });
                    return;
                }

                const encryptedKey = dbHelpers.getDecryptedApiKeyById(org.encrypted_api_key_id);
                if (!encryptedKey) {
                    res.status(404).json({ error: 'Secret API key not found for organization' });
                    return;
                }

                logger.info('scanning repository');
                const ss = new ScanService(org.name, rep, encryptedKey.key);
                const commits = await ss.scan();

                res.json({ message: "about to analyze " + commits.length + " commits" });
            } catch (err) {
                if (err instanceof Joi.ValidationError) {
                    res.status(422).json({
                        message: "validation errors",
                        errors: err.details,
                    })
                } else {
                    console.error(err);
                    res.status(500).json({

                    })
                }
            }
        })
    });
}
