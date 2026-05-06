import dotenv from 'dotenv';

dotenv.config();

const deployToken = process.env.DEPLOY_TOKEN ?? null;

if (!deployToken) {
    throw new Error('DEPLOY_TOKEN is empty');
}

const hostProjectDir = process.env.HOST_PROJECT_DIR ?? null;

if (!hostProjectDir) {
    throw new Error('HOST_PROJECT_DIR is empty');
}

export const config = {
    port: 3000,
    deployToken: deployToken,
    hostProjectDir: hostProjectDir,
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.BULLMQ_REDIS_PORT || process.env.REDIS_PORT || '6379'),
    },
};
