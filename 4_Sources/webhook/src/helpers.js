import {Log} from './log.js';
import {config} from './config.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const EXEC_OPTIONS = { maxBuffer: 10 * 1024 * 1024 };
const DEPLOY_CLEANUP_ENABLED = true;
const DEPLOY_CLEANUP_MODE = 'safe';
const DEPLOY_CLEANUP_IMAGE_UNTIL = '24h';
const DEPLOY_CLEANUP_BUILDER_UNTIL = '24h';

async function runShellCommand(command, label) {
    Log.info(`${label} started`, { command });

    const { stdout, stderr } = await execAsync(command, EXEC_OPTIONS);

    Log.info(`${label} finished`, { stdout, stderr });

    return { stdout, stderr };
}

function buildCleanupCommands() {
    if (!DEPLOY_CLEANUP_ENABLED) {
        return [];
    }

    const commands = [
        'docker image prune -f',
        `docker builder prune -af --filter "until=${DEPLOY_CLEANUP_BUILDER_UNTIL}"`,
    ];

    if (DEPLOY_CLEANUP_MODE === 'aggressive') {
        commands.push(
            `docker image prune -af --filter "until=${DEPLOY_CLEANUP_IMAGE_UNTIL}"`,
        );
    }

    return commands;
}

async function runPostDeployCleanup() {
    const commands = buildCleanupCommands();

    if (commands.length === 0) {
        Log.info('Deploy cleanup skipped');
        return;
    }

    for (const command of commands) {
        try {
            await runShellCommand(command, 'Deploy cleanup');
        } catch (error) {
            Log.warning('Deploy cleanup failed', {
                command,
                stdout: error.stdout,
                stderr: error.stderr,
                error: error.message,
            });
        }
    }
}

export async function runDeployment(repos) {
    const compose = `docker compose --env-file ${config.hostProjectDir}/.env -f ${config.hostProjectDir}/docker-compose.yml`;
    const command = `${compose} pull repos && ${compose} up -d --no-deps repos`;

    try {
        const { stdout, stderr } = await runShellCommand(command, 'Deploy');
        Log.info('Deploy success', { repos, stdout, stderr });
        await runPostDeployCleanup();
    } catch (e) {
        Log.error('Deploy failed', { repos, stdout: e.stdout, stderr: e.stderr, error: e.message });
        throw e;
    }
}


export function verifyBearerToken(req) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) return false;
    const token = header.slice(7);
    return token === config.deployToken;
}
