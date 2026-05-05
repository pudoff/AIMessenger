import {Queue, Worker} from 'bullmq';
import {config} from './config.js';
import {Log} from './log.js';
import {runDeployment} from './helpers.js';

const connection = config.redis;

const QUEUE_NAME = 'deploy';

export const deployQueue = new Queue(QUEUE_NAME, {connection});

export function startDeployWorker() {
    const worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            const {repo} = job.data;
            Log.info('Deploy job started', {jobId: job.id, repo});
            await runDeployment(repo);
        },
        {connection, concurrency: 1},
    );

    worker.on('completed', (job) => {
        Log.info('Deploy job completed', {jobId: job.id, repo: job.data.repo});
    });

    worker.on('failed', (job, err) => {
        Log.error('Deploy job failed', {jobId: job?.id, repo: job?.data?.repo, error: err.message});
    });

    Log.info('Deploy worker started');

    return worker;
}
