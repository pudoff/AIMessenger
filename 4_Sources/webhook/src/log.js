import winston from 'winston';

const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    levels: winston.config.syslog.levels,
    format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'}),
        winston.format.errors({stack: true}),
        winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
});

function generateMeta(data) {
    return {
        timestamp: new Date().toISOString(),
        data: data !== undefined ? data : undefined,
    };
}

export const Log = {
    debug(message, data) {
        winstonLogger.debug(message, generateMeta(data));
    },
    info(message, data) {
        winstonLogger.info(message, generateMeta(data));
    },
    notice(message, data) {
        winstonLogger.notice(message, generateMeta(data));
    },
    warning(message, data) {
        winstonLogger.warning(message, generateMeta(data));
    },
    error(message, data) {
        winstonLogger.error(message, generateMeta(data));
    },
    critical(message, data) {
        winstonLogger.crit(message, generateMeta(data));
    },
    alert(message, data) {
        winstonLogger.alert(message, generateMeta(data));
    },
    emergency(message, data) {
        winstonLogger.emerg(message, generateMeta(data));
    },
};
