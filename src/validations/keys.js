import joi from 'joi';

export const continuePendingIntegrationScheme = joi.object({
	integration_id: joi.number().required(),
	organizations: joi.array().items(joi.object({
		name: joi.string().required(),
		repositories: joi.array().min(0).items(joi.object({
			name: joi.string().required(),
		}))
	})),
	scan_filter: joi.valid('all', 'future').required()
});

