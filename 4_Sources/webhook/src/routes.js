import {verifyBearerToken} from './helpers.js';
import {deployQueue} from './queue.js';
import {Log} from './log.js';


export async function deployRoute(req, res) {
    if (!verifyBearerToken(req)) {
        Log.warning('Deploy: invalid or missing token');
        return res.status(401).json({error: 'unauthorized'});
    }

    const {repo} = req.body ?? {};

    if (!repo || typeof repo !== 'string') {
        Log.warning('Deploy: missing repo', {body: req.body});
        return res.status(422).json({error: 'missing_repo'});
    }

    const job = await deployQueue.add('deploy', {repo}, {
        removeOnComplete: 50,
        removeOnFail: 50,
    });

    Log.info('Deploy job enqueued', {jobId: job.id, repo});

    return res.status(200).json({ok: true});
}