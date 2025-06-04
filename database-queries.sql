-- Useful SQLite queries to explore your database

-- Show all tables
.tables

-- Show table structure
.schema users
.schema commits

-- View all users
SELECT * FROM users;

-- View user count
SELECT COUNT(*) as total_users FROM users;

-- View commits count per user
SELECT user_name, COUNT(*) as commit_count 
FROM commits 
GROUP BY user_name 
ORDER BY commit_count DESC;

-- View recent commits
SELECT commit_hash, user_name, commit_message, timestamp 
FROM commits 
ORDER BY timestamp DESC 
LIMIT 10;

-- View commits by status
SELECT status, COUNT(*) as count 
FROM commits 
GROUP BY status;

-- View user details
SELECT u.username, u.name, u.role, ud.email, ud.phone 
FROM users u 
LEFT JOIN user_details ud ON u.id = ud.user_id;

-- View daily commit summary
SELECT date, user_name, total_commits, total_hours 
FROM daily_commits 
ORDER BY date DESC 
LIMIT 10;

-- Export data to CSV (example for users)
.mode csv
.output users.csv
SELECT * FROM users;
.output stdout
.mode column