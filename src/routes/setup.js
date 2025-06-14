import express from 'express';
import { Router } from "../api/middleware/router.js";
import { setupAuth } from './auth.routes.js';
import { setupAi } from './ai.routes.js';
import { setupGit } from './git.routes.js';

export function routes() {
	const router = new Router(express.Router())

	setupAuth(router);
	setupAi(router);
	setupGit(router);

	return router.router;
}
