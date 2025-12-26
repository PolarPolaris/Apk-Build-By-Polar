// src/core/logger.ts
// Sistema de logging estruturado

import winston from 'winston';
import { join } from 'path';
import { getAppRoot } from './environment';

const logDir = join(getAppRoot(), 'logs');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, module, ...meta }) => {
        const moduleStr = module ? `[${module}]` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level.toUpperCase()} ${moduleStr} ${message}${metaStr}`;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        new winston.transports.File({
            filename: join(logDir, 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: join(logDir, 'combined.log')
        })
    ]
});

export function createLogger(module: string) {
    return logger.child({ module });
}

export { logger };
