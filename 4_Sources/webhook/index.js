import express from 'express';
import {Log} from './src/log.js';
import {deployRoute} from './src/routes.js';
import {startDeployWorker} from './src/queue.js';
import {config} from './src/config.js';

const app = express();

const host = '0.0.0.0';

app.post('/deploy', express.json(), deployRoute);
// app.post('/webhook', express.raw({type: '*/*', limit: '1mb'}), webhookRoute);

app.get('/health', (_req, res) => {
    res.status(200).send('ok');
});

startDeployWorker();

app.listen(config.port, host, () => {
    Log.info(`Webhook listening on ${host}:${config.port}`);
});
