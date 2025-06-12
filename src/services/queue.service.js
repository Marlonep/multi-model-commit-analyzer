import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger.js';
import { dbHelpers } from '../database/db.js';
import { AICommitAnalyzer } from '../analyzers/ai-commit.analyzer.js';

export class QueueService {
    /**
     * @type {Queue}
     * @access private
     */
    #queue;

    /**
     * @type {Worker}
     * @access private
     */
    #worker;

    /**
     * @type {IORedis}
     * @access private
     */
    #connection;

    /**
    * @param {object} opts
    * @param {number} opts.numberConcurrency
    * @param {string} opts.redisUrl
    */
    constructor(opts) {
        const QueueName = "analysis";
        this.#connection = new IORedis(opts.redisUrl, { maxRetriesPerRequest: null });
        this.#queue = new Queue(QueueName, {
            connection: this.#connection,
        });
        this.#queue.setGlobalConcurrency(opts.numberConcurrency);


        this.#worker = new Worker(QueueName, async (job) => {
            // const commit 
            logger.info(`processing job: ${job.name}`);
            const commit = dbHelpers.getCommitById(job.data.id);

            // @@@ TODO: Handle possible errors (race condition..?)
            // if (!commit) {
            // }

            try {
                const analyzer = new AICommitAnalyzer();
                // @@@ TODO: Error handling, IMPORTANT
                const scores = await analyzer.analyzeCommit(job.data.diff, {
                    message: commit.message,
                    author: commit.user_name,
                    filesChanged: 0,
                    linesAdded: commit.lines_added,
                    linesDeleted: commit.lines_deleted,
                });

                const avgQuality = scores.reduce((sum, s) => sum + s.codeQuality, 0) / scores.length;
                const avgDevLevel = scores.reduce((sum, s) => sum + s.devLevel, 0) / scores.length;
                const avgComplexity = scores.reduce((sum, s) => sum + s.complexity, 0) / scores.length;
                const avgHours = scores.reduce((sum, s) => sum + s.estimatedHours, 0) / scores.length;
                const avgAiPercentage = scores.reduce((sum, s) => sum + s.aiPercentage, 0) / scores.length;
                const avgHoursWithAi = scores.reduce((sum, s) => sum + s.estimatedHoursWithAi, 0) / scores.length;

                // Calculate total cost and tokens (moved up before creating analysis)
                const totalCost = scores.reduce((sum, s) => sum + s.cost, 0);
                const totalTokens = scores.reduce((sum, s) => sum + s.tokensUsed, 0);
                // const avgCostPerModel = totalCost / scores.length;

                dbHelpers.updateCommitScoresById(job.data.id, {
                    avgQuality,
                    avgDevLevel,
                    avgComplexity,
                    avgHours,
                    avgHoursWithAi,
                    avgAiPercentage,
                    totalCost,
                    totalTokens,
                    scores
                });
                // console.log(scores);
            } catch (err) {
                console.error(err);
            }


            return '';
        }, {
            connection: this.#connection,
        });

        this.#worker.on('completed', (job) => {
            logger.info(`completed: ${job.name}`);
        });

        this.#worker.on('failed', (job, error) => {
            logger.error(`failed at job: ${job?.name}`);
            console.error(error);
        });
    }

    /**
    * @param {object} opts
    * @param {number} opts.id
    * @param {string} opts.hash
    */
    add(opts) {
        this.#queue.add(`commit-#${opts.id}`, opts);
    }
}
