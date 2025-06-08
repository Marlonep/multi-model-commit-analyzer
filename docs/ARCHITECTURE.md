# Project Architecture

## Directory Structure

```
multi-model-commit-analyzer/
│
├── src/                          # Backend source code
│   ├── api/                      # API endpoints and middleware
│   │   ├── routes/               # API route handlers
│   │   └── middleware/           # Express middleware
│   │
│   ├── analyzers/                # Core analysis logic
│   │   ├── commitAnalyzer.js     # Main commit analysis engine
│   │   └── codeAnalyzer.js       # Code line categorization
│   │
│   ├── database/                 # Database related files
│   │   ├── db.js                 # Main database configuration
│   │   ├── migrations/           # Database migrations
│   │   └── queries/              # SQL query helpers
│   │
│   ├── services/                 # Business logic services
│   │   ├── github.service.js     # GitHub API interactions
│   │   ├── keyManager.service.js # API key management
│   │   └── webhook.service.js    # Webhook handlers
│   │
│   ├── utils/                    # Utility functions
│   │   └── helpers.js            # Common helper functions
│   │
│   └── server.js                 # Main Express server
│
├── scripts/                      # Standalone utility scripts
│   ├── analysis/                 # Commit analysis scripts
│   │   ├── analyzeAllCommits.js  # Analyze all commits
│   │   ├── analyzeMissingCommits.js # Find and analyze missing commits
│   │   └── extractLastCommit.js  # Extract last commit data
│   │
│   ├── reports/                  # Report generation
│   │   ├── generateDailyReport.js # Daily commit reports
│   │   └── setup-daily-commits.js # Setup daily tracking
│   │
│   └── admin/                    # Administrative tasks
│       ├── reset-admin-password.js # Reset admin password
│       └── view-database.js      # Database viewer
│
├── public/                       # Frontend files
│   ├── pages/                    # HTML pages and JS files
│   └── assets/                   # CSS and other assets
│
├── tests/                        # Test files
│   ├── api/                      # API tests
│   └── analyzers/                # Analyzer tests
│
├── config/                       # Configuration files
└── docs/                         # Documentation
```

## Key Components

### Backend (src/)
- **Server**: Express.js application with authentication
- **Analyzers**: AI-powered commit analysis using multiple models
- **Database**: SQLite with better-sqlite3
- **API**: RESTful endpoints for frontend communication

### Frontend (public/)
- **Pages**: Modern web interface with Matrix-themed dark UI
- **Assets**: Shared CSS and static files

### Scripts
- **Analysis**: Batch processing of commits
- **Reports**: Daily and periodic reporting
- **Admin**: System administration utilities

## Usage

### Development
```bash
npm run dev          # Start server with nodemon
npm run start        # Start production server
```

### Analysis
```bash
npm run analyze:all       # Analyze all commits
npm run analyze:missing   # Analyze missing commits only
npm run analyze:last      # Extract last commit data
```

### Reports
```bash
npm run report:daily      # Generate daily reports
```

### Administration
```bash
npm run admin:reset-password  # Reset admin password
npm run admin:view-db        # View database contents
```