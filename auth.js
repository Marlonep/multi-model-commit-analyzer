import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Initialize users database with default admin user
async function initializeUsers() {
    const usersPath = join(__dirname, 'users.json');
    
    try {
        // Check if users file exists
        await fs.access(usersPath);
        // File exists, don't regenerate
        return;
    } catch (error) {
        // Create default users file only if it doesn't exist
        const defaultUsers = [
            {
                id: 1,
                username: 'admin',
                password: await bcrypt.hash('admin123', 10),
                role: 'admin',
                name: 'Administrator'
            }
        ];
        await fs.writeFile(usersPath, JSON.stringify(defaultUsers, null, 2));
        console.log('Created default users.json file');
    }
}

// Load users from file
async function loadUsers() {
    const usersPath = join(__dirname, 'users.json');
    const data = await fs.readFile(usersPath, 'utf8');
    return JSON.parse(data);
}

// Authenticate user
export async function authenticateUser(username, password) {
    const users = await loadUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) {
        return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
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

// Initialize on module load
await initializeUsers();