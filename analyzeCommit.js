#!/usr/bin/env node

/**
 * Multi-Model Commit Analyzer
 * 
 * This tool analyzes git commits using multiple AI models (GPT-4, Claude Sonnet 4, Gemini 2.5 Flash, Grok)
 * to provide comprehensive code quality assessments. It evaluates code quality, developer
 * level, complexity, and estimates development time with and without AI assistance.
 * 
 * @author Marlon Espinosa
 * @version 1.0.0
 */

import { config } from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LineAnalyzer } from './codeAnalyzer.js';

// Load environment variables from .env file
config();

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// Pricing per 1K tokens (as of 2025)
const MODEL_PRICING = {
  'gpt-4': {
    input: 0.030,   // $30 per 1M input tokens
    output: 0.060   // $60 per 1M output tokens
  },
  'claude-sonnet-4-20250514': {
    input: 0.003,   // $3 per 1M input tokens
    output: 0.015   // $15 per 1M output tokens
  },
  'gemini-2.5-flash-preview-04-17': {
    input: 0.000075, // $0.075 per 1M input tokens
    output: 0.00030  // $0.30 per 1M output tokens
  },
  'grok-3': {
    input: 0.005,   // $5 per 1M input tokens (estimated)
    output: 0.015   // $15 per 1M output tokens (estimated)
  }
};

/**
 * Estimates the number of tokens in a text string
 * Uses a rough approximation of 1 token ≈ 4 characters
 * 
 * @param {string} text - The text to estimate tokens for
 * @returns {number} Estimated number of tokens
 */
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  // This is a simplified approximation - actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

/**
 * Represents the analysis score from a single AI model
 * Contains all metrics evaluated by the model including quality scores,
 * time estimates, and cost calculations
 */
class ModelScore {
  /**
   * @param {Object} data - Score data from AI model
   * @param {string} data.modelName - Name of the AI model
   * @param {string} data.provider - Provider of the AI model
   * @param {number} data.codeQuality - Code quality score (1-5)
   * @param {number} data.devLevel - Developer level (1-3)
   * @param {number} data.complexity - Code complexity (1-5)
   * @param {number} data.estimatedHours - Estimated development hours
   * @param {number} data.aiPercentage - Percentage of AI-generated code
   */
  constructor(data) {
    this.modelName = data.modelName;
    this.provider = data.provider;
    this.codeQuality = data.codeQuality;
    this.devLevel = data.devLevel;
    this.complexity = data.complexity;
    this.estimatedHours = data.estimatedHours;
    this.aiPercentage = data.aiPercentage;
    this.estimatedHoursWithAi = data.estimatedHoursWithAi;
    this.reasoning = data.reasoning;
    this.responseTime = data.responseTime;
    this.tokensUsed = data.tokensUsed || 0;
    this.cost = data.cost || 0;
  }
}

class CommitAnalysis {
  constructor(data) {
    this.commitHash = data.commitHash;
    this.commitMessage = data.commitMessage;
    this.timestamp = data.timestamp;
    this.user = data.user;
    this.project = data.project;
    this.fileChanges = data.fileChanges;
    this.linesAdded = data.linesAdded;
    this.linesDeleted = data.linesDeleted;
    this.modelScores = data.modelScores;
    this.averageCodeQuality = data.averageCodeQuality;
    this.averageDevLevel = data.averageDevLevel;
    this.averageComplexity = data.averageComplexity;
    this.averageEstimatedHours = data.averageEstimatedHours;
    this.averageAiPercentage = data.averageAiPercentage;
    this.averageEstimatedHoursWithAi = data.averageEstimatedHoursWithAi;
    this.totalTokens = data.totalTokens;
    this.totalCost = data.totalCost;
    this.avgCostPerModel = data.avgCostPerModel;
    this.codeAnalysis = data.codeAnalysis;
  }
}

class AIModels {
  constructor() {
    this.models = [];
    this.setupModels();
  }

  setupModels() {
    // OpenAI setup
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey !== 'your_api_key_here') {
      this.models.push({
        name: 'GPT-4',
        provider: 'OpenAI',
        client: new OpenAI({ apiKey: openaiKey }),
        type: 'openai'
      });
    }

    // Claude setup
    const claudeKey = process.env.CLAUDE_API_KEY;
    if (claudeKey && claudeKey !== 'your_claude_api_key_here') {
      this.models.push({
        name: 'Claude Sonnet 4',
        provider: 'Anthropic',
        client: new Anthropic({ apiKey: claudeKey }),
        type: 'claude'
      });
    }

    // Gemini setup
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      this.models.push({
        name: 'Gemini 2.5 Flash Preview',
        provider: 'Google',
        client: new GoogleGenerativeAI(geminiKey),
        type: 'gemini'
      });
    }

    // Grok setup
    const grokKey = process.env.GROK_API_KEY;
    if (grokKey && grokKey !== 'your_grok_api_key_here') {
      this.models.push({
        name: 'Grok 3',
        provider: 'xAI',
        client: new OpenAI({ 
          apiKey: grokKey,
          baseURL: 'https://api.x.ai/v1'
        }),
        type: 'grok'
      });
    }
  }

  async analyzeCommit(diffContent, commitInfo) {
    const prompt = `Analyze this git commit and provide scores on a scale as specified:

Commit: ${commitInfo.message}
Author: ${commitInfo.author}
Files changed: ${commitInfo.filesChanged}
Lines added: ${commitInfo.linesAdded}
Lines deleted: ${commitInfo.linesDeleted}

Diff:
${diffContent.substring(0, 2000)}  # Truncate for API limits

Please score the following metrics using DECIMAL PRECISION (e.g., 3.7, 2.3, 4.5):
1. Code Quality (1.0-5.0): Use decimals for nuanced scoring. 1.0=Poor, 2.0=Below Average, 3.0=Average, 4.0=Good, 5.0=Excellent
2. Developer Level (1.0-3.0): Use decimals. 1.0-1.5=Junior, 1.6-2.5=Mid-level, 2.6-3.0=Senior
3. Code Complexity (1.0-5.0): Use decimals. 1.0=Very Simple, 2.0=Simple, 3.0=Moderate, 4.0=Complex, 5.0=Very Complex
4. Estimated Development Time (in hours): Use decimals for precision
5. AI Code Percentage (0-100): Estimate what percentage of this code was likely written/generated by AI tools
6. Estimated Hours with AI: How many hours it would take if the developer used AI assistance

IMPORTANT: Provide precise decimal scores, not whole numbers. Each model should have its own unique perspective.

Respond ONLY in this JSON format:
{
  "code_quality": 3.7,
  "dev_level": 2.3,
  "complexity": 3.4,
  "estimated_hours": 2.75,
  "ai_percentage": 45.5,
  "estimated_hours_with_ai": 1.25,
  "reasoning": "Brief explanation of your scoring"
}`;

    if (!this.models.length) {
      return [];
    }

    const results = await Promise.all(
      this.models.map(model => this.getModelResponse(model, prompt))
    );

    return results.filter(r => r !== null);
  }

  async getModelResponse(modelInfo, prompt) {
    try {
      const startTime = Date.now();
      let result;
      let inputTokens = 0;
      let outputTokens = 0;
      let modelKey = '';

      if (modelInfo.type === 'openai') {
        const response = await modelInfo.client.chat.completions.create({
          model: 'o3-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        });
        result = response.choices[0].message.content;
        inputTokens = response.usage?.prompt_tokens || estimateTokens(prompt);
        outputTokens = response.usage?.completion_tokens || estimateTokens(result);
        modelKey = 'o3-mini';
      } else if (modelInfo.type === 'claude') {
        const response = await modelInfo.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }]
        });
        result = response.content[0].text;
        inputTokens = response.usage?.input_tokens || estimateTokens(prompt);
        outputTokens = response.usage?.output_tokens || estimateTokens(result);
        modelKey = 'claude-sonnet-4-20250514';
      } else if (modelInfo.type === 'gemini') {
        const model = modelInfo.client.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
        const response = await model.generateContent(prompt);
        result = response.response.text();
        // Gemini doesn't provide token counts, so we estimate
        inputTokens = estimateTokens(prompt);
        outputTokens = estimateTokens(result);
        modelKey = 'gemini-2.5-flash-preview-04-17';
      } else if (modelInfo.type === 'grok') {
        const response = await modelInfo.client.chat.completions.create({
          model: 'grok-3',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        });
        result = response.choices[0].message.content;
        inputTokens = response.usage?.prompt_tokens || estimateTokens(prompt);
        outputTokens = response.usage?.completion_tokens || estimateTokens(result);
        modelKey = 'grok-3';
      } else {
        return null;
      }

      // Calculate cost
      const pricing = MODEL_PRICING[modelKey];
      const cost = pricing ? 
        (inputTokens * pricing.input / 1000) + (outputTokens * pricing.output / 1000) : 
        0;

      const elapsedTime = (Date.now() - startTime) / 1000;

      // Parse JSON response
      try {
        const jsonStart = result.indexOf('{');
        const jsonEnd = result.lastIndexOf('}') + 1;
        let parsed;
        
        if (jsonStart !== -1 && jsonEnd !== 0) {
          const jsonStr = result.substring(jsonStart, jsonEnd);
          parsed = JSON.parse(jsonStr);
        } else {
          parsed = JSON.parse(result);
        }

        return new ModelScore({
          modelName: modelInfo.name,
          provider: modelInfo.provider,
          codeQuality: parseFloat(parsed.code_quality || 3.0),
          devLevel: parseFloat(parsed.dev_level || 2.0),
          complexity: parseFloat(parsed.complexity || 3.0),
          estimatedHours: parseFloat(parsed.estimated_hours || 1.0),
          aiPercentage: parseFloat(parsed.ai_percentage || 0.0),
          estimatedHoursWithAi: parseFloat(parsed.estimated_hours_with_ai || 1.0),
          reasoning: parsed.reasoning || 'No reasoning provided',
          responseTime: elapsedTime,
          tokensUsed: inputTokens + outputTokens,
          cost: cost
        });
      } catch (e) {
        return new ModelScore({
          modelName: modelInfo.name,
          provider: modelInfo.provider,
          codeQuality: 3.0,
          devLevel: 2.0,
          complexity: 3.0,
          estimatedHours: 1.0,
          aiPercentage: 0.0,
          estimatedHoursWithAi: 1.0,
          reasoning: `JSON parsing error: ${e.message}`,
          responseTime: elapsedTime,
          tokensUsed: inputTokens + outputTokens,
          cost: cost
        });
      }
    } catch (error) {
      return new ModelScore({
        modelName: modelInfo.name,
        provider: modelInfo.provider,
        codeQuality: 0.0,
        devLevel: 0.0,
        complexity: 0.0,
        estimatedHours: 0.0,
        aiPercentage: 0.0,
        estimatedHoursWithAi: 0.0,
        reasoning: `Error: ${error.message}`,
        responseTime: 0.0,
        tokensUsed: 0,
        cost: 0
      });
    }
  }
}

class CommitDatabase {
  constructor(dbFile = 'commit_analysis_history.json') {
    this.dbFile = dbFile;
    this.history = [];
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(this.dbFile, 'utf8');
      this.history = JSON.parse(data);
    } catch (error) {
      this.history = [];
    }
    return this.history;
  }

  async saveAnalysis(analysis) {
    await this.loadHistory();
    this.history.push(analysis);
    await fs.writeFile(this.dbFile, JSON.stringify(this.history, null, 2));
  }
}

async function getCommitInfo(commitHash = 'HEAD') {
  try {
    // Get commit info
    const { stdout: infoOutput } = await execAsync(
      `git show --format='%H|%s|%an|%ad' --date=iso --no-patch ${commitHash}`
    );

    // Get diff
    const { stdout: statOutput } = await execAsync(
      `git show --format= --stat ${commitHash}`
    );

    // Get actual diff content
    const { stdout: diffContent } = await execAsync(
      `git show --format= ${commitHash}`
    );

    // Parse commit info
    const infoLine = infoOutput.trim();
    const [hash, message, author, date] = infoLine.split('|');

    // Parse stats
    const statLines = statOutput.trim().split('\n');
    let filesChanged = 0;
    let linesAdded = 0;
    let linesDeleted = 0;

    for (const line of statLines) {
      if (line.includes('changed') && (line.includes('insertion') || line.includes('deletion'))) {
        const parts = line.trim().split(' ');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === 'files' && i > 0) {
            filesChanged = parseInt(parts[i - 1]);
          } else if (parts[i].includes('insertion') && i > 0) {
            linesAdded = parseInt(parts[i - 1]);
          } else if (parts[i].includes('deletion') && i > 0) {
            linesDeleted = parseInt(parts[i - 1]);
          }
        }
      }
    }

    const commitInfo = {
      hash,
      message,
      author,
      date,
      filesChanged,
      linesAdded,
      linesDeleted
    };

    return { diffContent, commitInfo };
  } catch (error) {
    console.error(`Error getting commit info: ${error.message}`);
    process.exit(1);
  }
}

function printModelScoresTable(modelScores) {
  console.log('\n' + '='.repeat(170));
  console.log('📊 DETAILED MODEL ANALYSIS');
  console.log('='.repeat(170));

  // Header
  console.log(
    `${'Model'.padEnd(20)} ${'Provider'.padEnd(10)} ${'Quality'.padEnd(8)} ` +
    `${'Dev Lvl'.padEnd(10)} ${'Complex'.padEnd(8)} ${'Hours'.padEnd(7)} ` +
    `${'AI %'.padEnd(7)} ${'AI Hrs'.padEnd(7)} ${'Tokens'.padEnd(8)} ${'Cost $'.padEnd(8)} ${'Time(s)'.padEnd(7)}`
  );
  console.log('-'.repeat(170));

  // Data rows
  let totalCost = 0;
  let totalTokens = 0;
  
  for (const score of modelScores) {
    const devLevelStr = `${score.devLevel.toFixed(1)} (${
      score.devLevel <= 1.5 ? 'Jr' : score.devLevel <= 2.5 ? 'Mid' : 'Sr'
    })`;
    
    totalCost += score.cost;
    totalTokens += score.tokensUsed;
    
    console.log(
      `${score.modelName.padEnd(20)} ${score.provider.padEnd(10)} ` +
      `${score.codeQuality.toFixed(1).padEnd(8)} ${devLevelStr.padEnd(10)} ` +
      `${score.complexity.toFixed(1).padEnd(8)} ${score.estimatedHours.toFixed(1).padEnd(7)} ` +
      `${score.aiPercentage.toFixed(1).padEnd(7)} ${score.estimatedHoursWithAi.toFixed(1).padEnd(7)} ` +
      `${score.tokensUsed.toString().padEnd(8)} $${score.cost.toFixed(4).padEnd(7)} ` +
      `${score.responseTime.toFixed(2).padEnd(7)}`
    );
  }
  
  // Total row
  console.log('-'.repeat(170));
  console.log(
    `${'TOTAL'.padEnd(20)} ${' '.padEnd(10)} ${' '.padEnd(8)} ` +
    `${' '.padEnd(10)} ${' '.padEnd(8)} ${' '.padEnd(7)} ` +
    `${' '.padEnd(7)} ${' '.padEnd(7)} ` +
    `${totalTokens.toString().padEnd(8)} $${totalCost.toFixed(4).padEnd(7)} ${' '.padEnd(7)}`
  );
  console.log('='.repeat(170));

  console.log('\n📝 Model Reasoning:');
  modelScores.forEach((score, i) => {
    console.log(`${i + 1}. ${score.provider} - ${score.modelName}:`);
    console.log(`   ${score.reasoning}\n`);
  });
}

function printCommitHistoryTable(history) {
  if (!history.length) {
    console.log('\n📈 COMMIT HISTORY: No previous commits analyzed');
    return;
  }

  console.log('\n' + '='.repeat(220));
  console.log('📈 COMMIT HISTORY SUMMARY');
  console.log('='.repeat(220));

  // Basic info header
  console.log('BASIC INFO:');
  console.log(
    `${'Date'.padEnd(12)} ${'Hash'.padEnd(10)} ${'User'.padEnd(12)} ${'Project'.padEnd(15)} ` +
    `${'Files'.padEnd(7)} ${'+Lines'.padEnd(7)} ${'-Lines'.padEnd(7)} ${'Message'.padEnd(40)}`
  );
  console.log('-'.repeat(220));

  // Show last 10
  const recentHistory = history.slice(-10);

  for (const commit of recentHistory) {
    const dateStr = commit.timestamp.substring(0, 10);
    const hashShort = commit.commitHash.substring(0, 8);
    const author = (commit.user || 'unknown').substring(0, 11);
    const project = (commit.project || 'unknown').substring(0, 14);
    const message = commit.commitMessage.substring(0, 39);

    console.log(
      `${dateStr.padEnd(12)} ${hashShort.padEnd(10)} ${author.padEnd(12)} ${project.padEnd(15)} ` +
      `${(commit.fileChanges || 0).toString().padEnd(7)} ${('+' + (commit.linesAdded || 0)).padEnd(7)} ` +
      `${('-' + (commit.linesDeleted || 0)).padEnd(7)} ${message.padEnd(40)}`
    );
  }

  // Analysis scores header
  console.log('\nANALYSIS SCORES:');
  console.log(
    `${'Date'.padEnd(12)} ${'Quality'.padEnd(8)} ${'Dev Lvl'.padEnd(8)} ${'Complex'.padEnd(8)} ` +
    `${'Hours'.padEnd(7)} ${'AI %'.padEnd(6)} ${'AI Hrs'.padEnd(7)} ${'Savings'.padEnd(8)}`
  );
  console.log('-'.repeat(220));

  for (const commit of recentHistory) {
    const dateStr = commit.timestamp.substring(0, 10);
    const devLevel = commit.averageDevLevel <= 1.5 ? 'Jr' : commit.averageDevLevel <= 2.5 ? 'Mid' : 'Sr';
    const savings = commit.averageEstimatedHours - commit.averageEstimatedHoursWithAi;
    const savingsPercent = (savings / commit.averageEstimatedHours * 100).toFixed(0);

    console.log(
      `${dateStr.padEnd(12)} ${commit.averageCodeQuality.toFixed(1).padEnd(8)} ` +
      `${commit.averageDevLevel.toFixed(1).padEnd(3)}${('(' + devLevel + ')').padEnd(5)} ` +
      `${commit.averageComplexity.toFixed(1).padEnd(8)} ` +
      `${commit.averageEstimatedHours.toFixed(1).padEnd(7)} ` +
      `${(commit.averageAiPercentage || 0).toFixed(0).padEnd(6)} ` +
      `${(commit.averageEstimatedHoursWithAi || 0).toFixed(1).padEnd(7)} ` +
      `${savings.toFixed(1)}h(${savingsPercent}%)`.padEnd(8)
    );
  }

  // Cost analysis header
  console.log('\nCOST ANALYSIS:');
  console.log(
    `${'Date'.padEnd(12)} ${'Tokens'.padEnd(10)} ${'Total Cost'.padEnd(12)} ${'Avg/Model'.padEnd(12)}`
  );
  console.log('-'.repeat(220));

  let grandTotalTokens = 0;
  let grandTotalCost = 0;

  for (const commit of recentHistory) {
    const dateStr = commit.timestamp.substring(0, 10);
    const tokens = commit.totalTokens || 0;
    const cost = commit.totalCost || 0;
    const avgCost = commit.avgCostPerModel || 0;
    
    grandTotalTokens += tokens;
    grandTotalCost += cost;

    console.log(
      `${dateStr.padEnd(12)} ${tokens.toLocaleString().padEnd(10)} ` +
      `$${cost.toFixed(4).padEnd(11)} $${avgCost.toFixed(4).padEnd(11)}`
    );
  }

  // Grand totals
  console.log('='.repeat(220));
  console.log(
    `${'GRAND TOTAL'.padEnd(12)} ${grandTotalTokens.toLocaleString().padEnd(10)} ` +
    `$${grandTotalCost.toFixed(4).padEnd(11)} $${(grandTotalCost / recentHistory.length).toFixed(4).padEnd(11)}`
  );

  if (history.length > 10) {
    console.log(`\n... showing last 10 of ${history.length} commits`);
  }
}

async function main() {
  // Get commit hash from arguments or use HEAD
  const commitHash = process.argv[2] || 'HEAD';
  
  // Check if we're in a git repository
  try {
    await execAsync('git rev-parse --git-dir');
  } catch (error) {
    console.error('Error: Not in a git repository');
    process.exit(1);
  }

  // Get git user info
  let user = process.argv[3] || 'unknown';
  let project = process.argv[4] || 'unknown';
  
  // Try to get user from git config if not provided
  if (user === 'unknown') {
    try {
      const { stdout: gitUser } = await execAsync('git config user.name');
      user = gitUser.trim() || 'unknown';
    } catch (error) {
      // Fallback to commit author
      try {
        const { stdout: commitAuthor } = await execAsync(`git show --format=%an -s ${commitHash}`);
        user = commitAuthor.trim().split(' ')[0] || 'unknown';
      } catch (e) {
        user = 'unknown';
      }
    }
  }
  
  // Try to get project name from git remote if not provided
  if (project === 'unknown') {
    try {
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
      // Extract project name from URL (works for both HTTPS and SSH URLs)
      const cleanUrl = remoteUrl.trim();
      const match = cleanUrl.match(/[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/);
      if (match) {
        project = match[2].replace(/\.git$/, ''); // Repository name without .git
      }
    } catch (error) {
      // Fallback to current directory name
      try {
        const { stdout: pwd } = await execAsync('pwd');
        project = pwd.trim().split('/').pop() || 'unknown';
      } catch (e) {
        project = 'unknown';
      }
    }
  }

  console.log('🚀 Enhanced Multi-Model Commit Analyzer');
  console.log(`📝 User: ${user} | Project: ${project}`);
  console.log('='.repeat(80));

  // Get commit diff and info
  const { diffContent, commitInfo } = await getCommitInfo(commitHash);

  if (!diffContent.trim()) {
    console.log('No changes found in this commit');
    process.exit(0);
  }

  console.log(`Analyzing commit: ${commitInfo.hash.substring(0, 8)} - ${commitInfo.message}`);
  console.log(`Author: ${commitInfo.author} | Date: ${commitInfo.date}`);
  console.log(`Files: ${commitInfo.filesChanged} | +${commitInfo.linesAdded} -${commitInfo.linesDeleted}`);

  // Run code line analysis on the repository
  console.log('\n📊 Running code analysis on repository...');
  const lineAnalyzer = new LineAnalyzer();
  await lineAnalyzer.analyze('.');
  
  const codeAnalysis = {
    totalLines: lineAnalyzer.stats.total,
    codeLines: lineAnalyzer.stats.code,
    commentLines: lineAnalyzer.stats.comments,
    textLines: lineAnalyzer.stats.text,
    blankLines: lineAnalyzer.stats.blank,
    codePercent: ((lineAnalyzer.stats.code / (lineAnalyzer.stats.total - lineAnalyzer.stats.blank)) * 100).toFixed(1),
    commentPercent: ((lineAnalyzer.stats.comments / (lineAnalyzer.stats.total - lineAnalyzer.stats.blank)) * 100).toFixed(1),
    textPercent: ((lineAnalyzer.stats.text / (lineAnalyzer.stats.total - lineAnalyzer.stats.blank)) * 100).toFixed(1)
  };

  // Initialize AI models and analyze
  const aiModels = new AIModels();
  console.log(`\n🤖 Analyzing with ${aiModels.models.length} AI models...`);

  const modelScores = await aiModels.analyzeCommit(diffContent, commitInfo);

  if (!modelScores.length) {
    console.log('No AI models available. Please check your API keys in .env file.');
    process.exit(1);
  }

  // Calculate averages
  const avgQuality = modelScores.reduce((sum, s) => sum + s.codeQuality, 0) / modelScores.length;
  const avgDevLevel = modelScores.reduce((sum, s) => sum + s.devLevel, 0) / modelScores.length;
  const avgComplexity = modelScores.reduce((sum, s) => sum + s.complexity, 0) / modelScores.length;
  const avgHours = modelScores.reduce((sum, s) => sum + s.estimatedHours, 0) / modelScores.length;
  const avgAiPercentage = modelScores.reduce((sum, s) => sum + s.aiPercentage, 0) / modelScores.length;
  const avgHoursWithAi = modelScores.reduce((sum, s) => sum + s.estimatedHoursWithAi, 0) / modelScores.length;

  // Calculate total cost and tokens (moved up before creating analysis)
  const totalCost = modelScores.reduce((sum, s) => sum + s.cost, 0);
  const totalTokens = modelScores.reduce((sum, s) => sum + s.tokensUsed, 0);
  const avgCostPerModel = totalCost / modelScores.length;

  // Create analysis record
  const analysis = new CommitAnalysis({
    commitHash: commitInfo.hash,
    commitMessage: commitInfo.message,
    timestamp: new Date().toISOString(),
    user,
    project,
    fileChanges: commitInfo.filesChanged,
    linesAdded: commitInfo.linesAdded,
    linesDeleted: commitInfo.linesDeleted,
    modelScores,
    averageCodeQuality: avgQuality,
    averageDevLevel: avgDevLevel,
    averageComplexity: avgComplexity,
    averageEstimatedHours: avgHours,
    averageAiPercentage: avgAiPercentage,
    averageEstimatedHoursWithAi: avgHoursWithAi,
    totalTokens,
    totalCost,
    avgCostPerModel,
    codeAnalysis
  });

  // Print results
  printModelScoresTable(modelScores);

  console.log('\n📊 AVERAGE SCORES:');
  console.log(`Code Quality: ${avgQuality.toFixed(1)}/5`);
  console.log(`Developer Level: ${avgDevLevel.toFixed(1)}/3 (${
    avgDevLevel <= 1.5 ? 'Junior' : avgDevLevel <= 2.5 ? 'Mid' : 'Senior'
  })`);
  console.log(`Complexity: ${avgComplexity.toFixed(1)}/5`);
  console.log(`Estimated Hours: ${avgHours.toFixed(1)}`);
  console.log(`AI Code Percentage: ${avgAiPercentage.toFixed(1)}%`);
  console.log(`Estimated Hours with AI: ${avgHoursWithAi.toFixed(1)}`);
  console.log(`Time Savings with AI: ${(avgHours - avgHoursWithAi).toFixed(1)} hours (${
    Math.round(((avgHours - avgHoursWithAi) / avgHours) * 100)
  }% reduction)`);
  
  console.log('\n💰 COST ANALYSIS:');
  console.log(`Total Tokens Used: ${totalTokens.toLocaleString()}`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Average Cost per Model: $${(totalCost / modelScores.length).toFixed(4)}`);

  // Save to database and show history
  const db = new CommitDatabase();
  await db.saveAnalysis(analysis);

  const history = await db.loadHistory();
  printCommitHistoryTable(history);

  console.log(`\n✅ Analysis complete! Saved to ${db.dbFile}`);
}

// Export classes for testing
export { AIModels, CommitDatabase, ModelScore, CommitAnalysis };

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}