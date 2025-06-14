import { Router } from "../api/middleware/router.js";
import { login } from "../api/controllers/auth.controller.js";

/**
 * @param {Router} router
*/
export function setupAuth(router) {
	router.post('/api/login', login);
}
