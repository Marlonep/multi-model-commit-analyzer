#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// File extensions by category
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go',
  '.rs', '.swift', '.kt', '.scala', '.rb', '.php', '.r', '.m', '.mm', '.h',
  '.hpp', '.cc', '.cxx', '.vue', '.svelte'
]);

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.rst', '.adoc', '.tex', '.doc', '.docx', '.pdf'
]);

const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf',
  '.properties', '.env', '.gitignore', '.dockerignore', '.editorconfig'
]);

class LineAnalyzer {
  constructor() {
    this.stats = {
      code: 0,
      comments: 0,
      text: 0,
      blank: 0,
      total: 0
    };
    this.fileCount = 0;
    this.processedFiles = 0;
  }

  // Detect comment patterns based on file extension
  getCommentPatterns(ext) {
    const patterns = {
      // C-style comments
      '.js': { single: '//', multi: { start: '/*', end: '*/' } },
      '.jsx': { single: '//', multi: { start: '/*', end: '*/' } },
      '.ts': { single: '//', multi: { start: '/*', end: '*/' } },
      '.tsx': { single: '//', multi: { start: '/*', end: '*/' } },
      '.java': { single: '//', multi: { start: '/*', end: '*/' } },
      '.c': { single: '//', multi: { start: '/*', end: '*/' } },
      '.cpp': { single: '//', multi: { start: '/*', end: '*/' } },
      '.cs': { single: '//', multi: { start: '/*', end: '*/' } },
      '.go': { single: '//', multi: { start: '/*', end: '*/' } },
      '.swift': { single: '//', multi: { start: '/*', end: '*/' } },
      '.kt': { single: '//', multi: { start: '/*', end: '*/' } },
      '.scala': { single: '//', multi: { start: '/*', end: '*/' } },
      '.rs': { single: '//', multi: { start: '/*', end: '*/' } },
      '.php': { single: '//', multi: { start: '/*', end: '*/' } },
      // Python-style
      '.py': { single: '#', multi: { start: '"""', end: '"""' } },
      '.rb': { single: '#', multi: { start: '=begin', end: '=end' } },
      '.r': { single: '#' },
      // Shell-style
      '.sh': { single: '#' },
      '.bash': { single: '#' },
      '.zsh': { single: '#' },
      '.yaml': { single: '#' },
      '.yml': { single: '#' },
      '.toml': { single: '#' },
      // HTML/XML style
      '.html': { multi: { start: '<!--', end: '-->' } },
      '.xml': { multi: { start: '<!--', end: '-->' } },
      '.vue': { single: '//', multi: { start: '/*', end: '*/' }, html: { start: '<!--', end: '-->' } },
      '.svelte': { single: '//', multi: { start: '/*', end: '*/' }, html: { start: '<!--', end: '-->' } }
    };
    
    return patterns[ext] || null;
  }

  // Analyze a single line
  analyzeLine(line, ext, inMultiComment) {
    const trimmed = line.trim();
    
    // Empty line
    if (!trimmed) {
      return { type: 'blank', inMultiComment };
    }

    const patterns = this.getCommentPatterns(ext);
    
    // Text files
    if (TEXT_EXTENSIONS.has(ext)) {
      return { type: 'text', inMultiComment: false };
    }

    // Config files - treat as code
    if (CONFIG_EXTENSIONS.has(ext)) {
      return { type: 'code', inMultiComment: false };
    }

    // No comment patterns for this file type
    if (!patterns) {
      return { type: 'code', inMultiComment: false };
    }

    // Check for multi-line comment end
    if (inMultiComment && patterns.multi) {
      if (trimmed.includes(patterns.multi.end)) {
        return { type: 'comment', inMultiComment: false };
      }
      return { type: 'comment', inMultiComment: true };
    }

    // Check for single-line comment
    if (patterns.single && trimmed.startsWith(patterns.single)) {
      return { type: 'comment', inMultiComment: false };
    }

    // Check for multi-line comment start
    if (patterns.multi && trimmed.includes(patterns.multi.start)) {
      const hasEnd = trimmed.includes(patterns.multi.end);
      return { type: 'comment', inMultiComment: !hasEnd };
    }

    // Otherwise it's code
    return { type: 'code', inMultiComment: false };
  }

  // Analyze a single file
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const ext = path.extname(filePath).toLowerCase();
      
      let inMultiComment = false;
      const fileStats = { code: 0, comments: 0, text: 0, blank: 0 };

      for (const line of lines) {
        const result = this.analyzeLine(line, ext, inMultiComment);
        inMultiComment = result.inMultiComment;
        fileStats[result.type]++;
      }

      // Update global stats
      this.stats.code += fileStats.code;
      this.stats.comments += fileStats.comments;
      this.stats.text += fileStats.text;
      this.stats.blank += fileStats.blank;
      this.stats.total += lines.length;

      this.processedFiles++;
      this.updateProgress();

      return fileStats;
    } catch (error) {
      // Skip files that can't be read
      this.processedFiles++;
      this.updateProgress();
      return null;
    }
  }

  /**
   * Updates the progress bar display in the terminal
   * Shows a visual representation of analysis progress
   */
  updateProgress() {
    const progress = (this.processedFiles / this.fileCount) * 100;
    const filled = Math.floor(progress / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    // Use carriage return to update the same line
    process.stdout.write(`\r📊 Analyzing: [${bar}] ${progress.toFixed(1)}% (${this.processedFiles}/${this.fileCount} files)`);
  }

  // Display final results with visual bars
  displayResults() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 CODE ANALYSIS RESULTS');
    console.log('='.repeat(80));

    const nonBlank = this.stats.total - this.stats.blank;
    const codePercent = (this.stats.code / nonBlank) * 100;
    const commentPercent = (this.stats.comments / nonBlank) * 100;
    const textPercent = (this.stats.text / nonBlank) * 100;

    console.log(`\nTotal Lines: ${this.stats.total.toLocaleString()} (${this.stats.blank.toLocaleString()} blank lines excluded)\n`);

    // Code lines
    const codeBar = this.createBar(codePercent, 50, '🟦');
    console.log(`Code:     ${this.stats.code.toLocaleString().padStart(8)} lines (${codePercent.toFixed(1)}%)`);
    console.log(`          ${codeBar}\n`);

    // Comment lines
    const commentBar = this.createBar(commentPercent, 50, '🟨');
    console.log(`Comments: ${this.stats.comments.toLocaleString().padStart(8)} lines (${commentPercent.toFixed(1)}%)`);
    console.log(`          ${commentBar}\n`);

    // Text lines
    const textBar = this.createBar(textPercent, 50, '🟩');
    console.log(`Text:     ${this.stats.text.toLocaleString().padStart(8)} lines (${textPercent.toFixed(1)}%)`);
    console.log(`          ${textBar}\n`);

    console.log('='.repeat(80));

    // Show target vs actual
    console.log('\n📊 Target vs Actual:');
    console.log(`   Code:     Target: 70% | Actual: ${codePercent.toFixed(1)}% ${this.getIndicator(codePercent, 70)}`);
    console.log(`   Comments: Target: 10% | Actual: ${commentPercent.toFixed(1)}% ${this.getIndicator(commentPercent, 10)}`);
    console.log(`   Text:     Target: 20% | Actual: ${textPercent.toFixed(1)}% ${this.getIndicator(textPercent, 20)}`);
  }

  createBar(percent, width, emoji) {
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return emoji.repeat(filled) + '⬜'.repeat(empty);
  }

  getIndicator(actual, target) {
    const diff = Math.abs(actual - target);
    if (diff <= 5) return '✅';
    if (diff <= 10) return '⚠️';
    return '❌';
  }

  // Get all files in directory recursively
  async getAllFiles(dir, fileList = []) {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        // Skip common directories
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'venv' && file !== '__pycache__') {
          await this.getAllFiles(filePath, fileList);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        if (CODE_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(ext) || CONFIG_EXTENSIONS.has(ext)) {
          fileList.push(filePath);
        }
      }
    }
    
    return fileList;
  }

  // Main analysis function
  async analyze(directory = '.') {
    console.log('🔍 Scanning directory for files...');
    
    const files = await this.getAllFiles(directory);
    this.fileCount = files.length;
    
    console.log(`📁 Found ${this.fileCount} files to analyze\n`);
    
    // Process files
    for (const file of files) {
      await this.analyzeFile(file);
    }
    
    this.displayResults();
  }
}

// Export for use in other modules
export { LineAnalyzer };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new LineAnalyzer();
  const directory = process.argv[2] || '.';
  
  analyzer.analyze(directory).catch(console.error);
}