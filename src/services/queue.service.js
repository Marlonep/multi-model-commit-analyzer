import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger.js';

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
            logger.info(`ready to process job: ${job.name}`);
            console.log('data', job.data);

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
