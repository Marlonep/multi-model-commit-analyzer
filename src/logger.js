import winston from 'winston';

export const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
	),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.simple(),
				winston.format.timestamp(),
				winston.format.json(),
			)
		}),
	],
});

export function createSublogger(name) {
	return logger.child({ module: name });
}
