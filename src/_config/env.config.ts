process.loadEnvFile();

type EnvConfig = {
  PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_HOST: string;
  DB_PORT: number;
};

const validateEnv = (): EnvConfig => {
  const env = process.env;

  const requiredEnvs: Record<keyof EnvConfig, (val: string) => any> = {
    PORT: (val) => {
      const port = Number(val);
      if (isNaN(port)) throw new Error("PORT must be a number");
      return port;
    },
    DB_USER: (val) => {
      if (!val) throw new Error("DB_USER is required");
      return val;
    },
    DB_PASSWORD: (val) => {
      if (!val) throw new Error("DB_PASSWORD is required");
      return val;
    },
    DB_NAME: (val) => {
      if (!val) throw new Error("DB_NAME is required");
      return val;
    },
    DB_HOST: (val) => {
      if (!val) throw new Error("DB_HOST is required");
      return val;
    },
    DB_PORT: (val) => {
      const port = Number(val);
      if (isNaN(port)) throw new Error("DB_PORT must be a number");
      return port;
    },
  };

  try {
    const validEnv = Object.entries(requiredEnvs).reduce(
      (acc, [key, validator]) => ({
        ...acc,
        [key]: validator(env[key] as string),
      }),
      {} as EnvConfig
    );

    return validEnv;
  } catch (error) {
    throw new Error(`Validation error: ${(error as Error).message}`);
  }
};

const env = validateEnv();

export const envConfig = {
  port: {
    PORT: env.PORT,
  },
  db: {
    DB_USER: env.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD,
    DB_NAME: env.DB_NAME,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
  },
};
