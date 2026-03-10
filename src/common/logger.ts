import pino from "pino";

export const logger = {
  pino: pino({
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss",
      },
    },
    level: "debug",
  }),

  withTag(tag: string) {
    const child = this.pino.child({ tag });
    return {
      debug: (msg: string, ...args: any[]) => child.debug(msg, ...args),
      info: (msg: string, ...args: any[]) => child.info(msg, ...args),
      warn: (msg: string, ...args: any[]) => child.warn(msg, ...args),
      error: (msg: string, ...args: any[]) => child.error(msg, ...args),
      success: (msg: string, ...args: any[]) => child.info(msg, ...args), // Map success to info
    };
  },
};
