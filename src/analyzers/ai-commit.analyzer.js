import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger.js';

// Pricing per 1K tokens (as of 2025)
const MODEL_PRICING = {
  'o3-mini': {
    input: 0.060,   // $60 per 1M input tokens
    output: 0.240   // $240 per 1M output tokens
  },
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
   * @param {number} data.estimatedHoursWithAi - Approximation of time spent by a model to develop
   * @param {string} data.reasoning - Reasoning behind scores from the modal
   * @param {number} data.responseTime - Time for request
   * @param {number} data.tokensUsed - Approximation of used tokens by modelName
   * @param {number} data.cost - Approximation of used costs
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

export class AICommitAnalyzer {
  constructor() {
    this.models = [];
    this.#setupModels();
  }

  #setupModels() {
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
    const prompt = `Analyze this git commit and provide scores based on OBJECTIVE criteria:

Commit: ${commitInfo.message}
Author: ${commitInfo.author}
Files changed: ${commitInfo.filesChanged}
Lines added: ${commitInfo.linesAdded}
Lines deleted: ${commitInfo.linesDeleted}

Diff:
${diffContent.substring(0, 2000)}

SCORING CRITERIA - Be consistent and objective:

1. Code Quality (1.0-5.0): 
   - Deduct points for: syntax errors, typos, poor structure, missing error handling
   - 1.0-2.0: Multiple errors/issues  |  2.1-3.0: Some issues  |  3.1-4.0: Minor issues  |  4.1-5.0: Clean code

2. Developer Level (1.0-3.0):
   - Based on: code patterns, architecture decisions, error handling sophistication
   - 1.0-1.5: Junior (basic changes, simple patterns)
   - 1.6-2.5: Mid-level (good practices, some architecture)  
   - 2.6-3.0: Senior (advanced patterns, excellent design)

3. Code Complexity (1.0-5.0):
   - Based on: number of files, logic complexity, integration points
   - 1.0-2.0: Simple changes  |  2.1-3.0: Moderate  |  3.1-4.0: Complex  |  4.1-5.0: Very complex

4. Estimated Development Time (hours): Realistic time for this exact change

5. AI Code Percentage (0-100): 
   - 0-20%: Clearly human-written, unique patterns
   - 21-40%: Some AI assistance likely
   - 41-60%: Moderate AI involvement
   - 61-80%: Heavy AI assistance
   - 81-100%: Mostly AI-generated

6. Estimated Hours with AI: Time with AI help (should be less than manual time)

BE OBJECTIVE: If you see typos or errors, score quality lower. If code is simple, don't overestimate complexity.

Respond ONLY in this JSON format:
{
  "code_quality": 3.7,
  "dev_level": 2.3,
  "complexity": 3.4,
  "estimated_hours": 2.75,
  "ai_percentage": 45.5,
  "estimated_hours_with_ai": 1.25,
  "reasoning": "Brief explanation focusing on specific issues or strengths observed"
}`;

    if (!this.models.length) {
      return [];
    }

    const results = await Promise.all(
      this.models.map(model => this.#getModelResponse(model, prompt))
    );

    return results.filter(r => r !== null);
  }

  async #getModelResponse(modelInfo, prompt) {
    logger.info(`starting model analysis with: ${modelInfo.name}`);
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
          max_completion_tokens: 8000  // Increased for o3-mini's internal reasoning
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
        // Check if result is empty (o3-mini issue)
        if (!result || result.trim() === '') {
          throw new Error('Empty response from model');
        }

        logger.info(`done with analysis of: ${modelInfo.name}`);
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
        // Return error state with 0.0 values instead of default values
        return new ModelScore({
          modelName: modelInfo.name,
          provider: modelInfo.provider,
          codeQuality: 0.0,
          devLevel: 0.0,
          complexity: 0.0,
          estimatedHours: 0.0,
          aiPercentage: 0.0,
          estimatedHoursWithAi: 0.0,
          reasoning: `Error: ${e.message}${result ? ` (Response: "${result.substring(0, 100)}...")` : ' (Empty response)'}`,
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
