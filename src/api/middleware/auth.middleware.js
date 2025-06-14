import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbHelpers } from '../../database/db.js';

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Authenticate user
export async function authenticateUser(username, password) {
    const user = dbHelpers.getUserByUsername(username);
    
    if (!user) {
        return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return null;
    }
    
    // Create JWT token
    const token = jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    };
}

// Verify JWT token
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Middleware to protect routes
export function requireAuth(req, res, next) {
    // Check if user is already authenticated via session (set by server.js middleware)
    if (req.user) {
        return next();
    }
    
    // Otherwise check for token in Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1]; // Bearer <token>
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = decoded;
    next();
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 **/
export function requireAdmin(req, res, next) {
	if (!req.user) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (req.user.role !== 'admin') {
		return res.status(403).json({ error: 'Forbidden: Admin access required' });
	}

	next();
}
