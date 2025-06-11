-- Initial database schema migration
-- This file serves as documentation for the database structure

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    github_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT,
    description TEXT,
    website TEXT,
    github_url TEXT,
    logo_url TEXT,
    location TEXT,
    industry TEXT,
    size_category TEXT,
    founded_date DATE,
    timezone TEXT,
    primary_language TEXT,
    tech_stack TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    organization_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Commits table
CREATE TABLE IF NOT EXISTS commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash TEXT UNIQUE NOT NULL,
    message TEXT,
    author TEXT,
    author_email TEXT,
    github_username TEXT,
    project TEXT,
    organization TEXT,
    date DATETIME,
    files_changed INTEGER,
    lines_added INTEGER,
    lines_deleted INTEGER,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI model analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_id INTEGER,
    model_name TEXT NOT NULL,
    code_quality REAL,
    developer_level REAL,
    complexity REAL,
    estimated_hours REAL,
    ai_code_percentage REAL,
    reasoning TEXT,
    tokens_used INTEGER,
    cost REAL,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (commit_id) REFERENCES commits(id)
);

-- Daily commits summary table
CREATE TABLE IF NOT EXISTS daily_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    user TEXT NOT NULL,
    commit_count INTEGER DEFAULT 0,
    total_files_changed INTEGER DEFAULT 0,
    total_lines_added INTEGER DEFAULT 0,
    total_lines_deleted INTEGER DEFAULT 0,
    average_code_quality REAL DEFAULT 0,
    average_complexity REAL DEFAULT 0,
    average_dev_level REAL DEFAULT 0,
    total_estimated_hours REAL DEFAULT 0,
    hours_with_ai REAL DEFAULT 0,
    projects TEXT DEFAULT '[]',
    commit_hashes TEXT DEFAULT '[]',
    commit_indices TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, user)
);

