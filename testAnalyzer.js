#!/usr/bin/env node

import fs from 'fs/promises';
import { AIModels, CommitDatabase } from './analyzeCommit.js';

async function testWithDiffFile() {
  // Read a sample diff file
  const diffFile = 'diffs/feature_user_auth.diff';
  
  try {
    await fs.access(diffFile);
  } catch (error) {
    console.error(`Error: ${diffFile} not found`);
    process.exit(1);
  }

  const diffContent = await fs.readFile(diffFile, 'utf8');

  // Mock commit info
  const commitInfo = {
    hash: 'abc123def',
    message: 'Add user authentication feature',
    author: 'john.doe',
    date: '2025-05-22 16:30:00',
    filesChanged: 1,
    linesAdded: 25,
    linesDeleted: 5
  };

  console.log('🚀 Enhanced Multi-Model Commit Analyzer (Test Mode)');
  console.log('📝 User: john.doe | Project: TestProject');
  console.log('='.repeat(80));
  console.log(`Analyzing commit: ${commitInfo.hash.substring(0, 8)} - ${commitInfo.message}`);
  console.log(`Author: ${commitInfo.author} | Date: ${commitInfo.date}`);
  console.log(`Files: ${commitInfo.filesChanged} | +${commitInfo.linesAdded} -${commitInfo.linesDeleted}`);

  // Initialize AI models and analyze
  const aiModels = new AIModels();
  console.log(`\n🤖 Analyzing with ${aiModels.models.length} AI models...`);

  if (!aiModels.models.length) {
    console.log('No AI models available. Please check your API keys in .env file.');
    process.exit(1);
  }

  const modelScores = await aiModels.analyzeCommit(diffContent, commitInfo);

  if (!modelScores.length) {
    console.log('No valid responses from AI models.');
    process.exit(1);
  }

  // Calculate averages
  const avgQuality = modelScores.reduce((sum, s) => sum + s.codeQuality, 0) / modelScores.length;
  const avgDevLevel = modelScores.reduce((sum, s) => sum + s.devLevel, 0) / modelScores.length;
  const avgComplexity = modelScores.reduce((sum, s) => sum + s.complexity, 0) / modelScores.length;
  const avgHours = modelScores.reduce((sum, s) => sum + s.estimatedHours, 0) / modelScores.length;
  const avgAiPercentage = modelScores.reduce((sum, s) => sum + s.aiPercentage, 0) / modelScores.length;
  const avgHoursWithAi = modelScores.reduce((sum, s) => sum + s.estimatedHoursWithAi, 0) / modelScores.length;

  // Create analysis record
  const analysis = {
    commitHash: commitInfo.hash,
    commitMessage: commitInfo.message,
    timestamp: new Date().toISOString(),
    user: 'john.doe',
    project: 'TestProject',
    fileChanges: commitInfo.filesChanged,
    linesAdded: commitInfo.linesAdded,
    linesDeleted: commitInfo.linesDeleted,
    modelScores,
    averageCodeQuality: avgQuality,
    averageDevLevel: avgDevLevel,
    averageComplexity: avgComplexity,
    averageEstimatedHours: avgHours,
    averageAiPercentage: avgAiPercentage,
    averageEstimatedHoursWithAi: avgHoursWithAi
  };

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

  // Save to database and show history
  const db = new CommitDatabase();
  await db.saveAnalysis(analysis);

  const history = await db.loadHistory();
  printCommitHistoryTable(history);

  console.log(`\n✅ Analysis complete! Saved to ${db.dbFile}`);
}

function printModelScoresTable(modelScores) {
  console.log('\n' + '='.repeat(150));
  console.log('📊 DETAILED MODEL ANALYSIS');
  console.log('='.repeat(150));

  // Header
  console.log(
    `${'Model'.padEnd(20)} ${'Provider'.padEnd(10)} ${'Quality'.padEnd(8)} ` +
    `${'Dev Lvl'.padEnd(10)} ${'Complex'.padEnd(8)} ${'Hours'.padEnd(7)} ` +
    `${'AI %'.padEnd(7)} ${'AI Hrs'.padEnd(7)} ${'Time(s)'.padEnd(7)}`
  );
  console.log('-'.repeat(150));

  // Data rows
  for (const score of modelScores) {
    const devLevelStr = `${score.devLevel.toFixed(1)} (${
      score.devLevel <= 1.5 ? 'Jr' : score.devLevel <= 2.5 ? 'Mid' : 'Sr'
    })`;
    
    console.log(
      `${score.modelName.padEnd(20)} ${score.provider.padEnd(10)} ` +
      `${score.codeQuality.toFixed(1).padEnd(8)} ${devLevelStr.padEnd(10)} ` +
      `${score.complexity.toFixed(1).padEnd(8)} ${score.estimatedHours.toFixed(1).padEnd(7)} ` +
      `${score.aiPercentage.toFixed(1).padEnd(7)} ${score.estimatedHoursWithAi.toFixed(1).padEnd(7)} ` +
      `${score.responseTime.toFixed(2).padEnd(7)}`
    );
  }

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

  console.log('\n' + '='.repeat(140));
  console.log('📈 COMMIT HISTORY SUMMARY');
  console.log('='.repeat(140));

  // Header
  console.log(
    `${'Date'.padEnd(12)} ${'Hash'.padEnd(8)} ${'Author'.padEnd(15)} ` +
    `${'Avg Quality'.padEnd(11)} ${'Avg Dev Lvl'.padEnd(11)} ` +
    `${'Avg Complex'.padEnd(11)} ${'Avg Hours'.padEnd(10)} ${'Message'.padEnd(50)}`
  );
  console.log('-'.repeat(140));

  // Show last 10
  const recentHistory = history.slice(-10);

  for (const commit of recentHistory) {
    const dateStr = commit.timestamp.substring(0, 10);
    const hashShort = (commit.commitHash || '').substring(0, 8);
    const author = (commit.user || '').substring(0, 14);
    const message = (commit.commitMessage || '').substring(0, 49);

    console.log(
      `${dateStr.padEnd(12)} ${hashShort.padEnd(8)} ${author.padEnd(15)} ` +
      `${commit.averageCodeQuality.toFixed(1).padEnd(11)} ` +
      `${commit.averageDevLevel.toFixed(1).padEnd(11)} ` +
      `${commit.averageComplexity.toFixed(1).padEnd(11)} ` +
      `${commit.averageEstimatedHours.toFixed(1).padEnd(10)} ${message.padEnd(50)}`
    );
  }

  if (history.length > 10) {
    console.log(`\n... and ${history.length - 10} more commits`);
  }
}

// Run the test
testWithDiffFile().catch(console.error);