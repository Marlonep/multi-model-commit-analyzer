import { authenticateUser } from "../middleware/auth.middleware.js";

export async function login(req, res) {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			return res.status(400).json({ error: 'Username and password are required' });
		}

		const result = await authenticateUser(username, password);

		if (!result) {
			return res.status(401).json({ error: 'Invalid username or password' });
		}

		// Set session
		req.session.userId = result.user.id;
		req.session.username = result.user.username;
		req.session.role = result.user.role;
		req.session.save();

		res.json({
			token: result.token,
			username: result.user.username,
			name: result.user.name,
			role: result.user.role
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Server error during login' });
	}
}
