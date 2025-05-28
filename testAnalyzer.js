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

  // Calculate total cost
  const totalCost = modelScores.reduce((sum, s) => sum + (s.cost || 0), 0);
  const totalTokens = modelScores.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);
  const avgCostPerModel = totalCost / modelScores.length;

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
    averageEstimatedHoursWithAi: avgHoursWithAi,
    totalTokens,
    totalCost,
    avgCostPerModel
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
    
    totalCost += score.cost || 0;
    totalTokens += score.tokensUsed || 0;
    
    console.log(
      `${score.modelName.padEnd(20)} ${score.provider.padEnd(10)} ` +
      `${score.codeQuality.toFixed(1).padEnd(8)} ${devLevelStr.padEnd(10)} ` +
      `${score.complexity.toFixed(1).padEnd(8)} ${score.estimatedHours.toFixed(1).padEnd(7)} ` +
      `${score.aiPercentage.toFixed(1).padEnd(7)} ${score.estimatedHoursWithAi.toFixed(1).padEnd(7)} ` +
      `${(score.tokensUsed || 0).toString().padEnd(8)} $${(score.cost || 0).toFixed(4).padEnd(7)} ` +
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
    const hashShort = (commit.commitHash || '').substring(0, 8);
    const author = (commit.user || 'unknown').substring(0, 11);
    const project = (commit.project || 'unknown').substring(0, 14);
    const message = (commit.commitMessage || '').substring(0, 39);

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
    const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
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

// Run the test
testWithDiffFile().catch(console.error);