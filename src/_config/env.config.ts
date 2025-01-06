process.loadEnvFile();

type EnvConfig = {
  PORT: number;
};

const validateEnv = (): EnvConfig => {
  const env = process.env;

  const requiredEnvs: Record<keyof EnvConfig, (val: string) => any> = {
    PORT: (val) => {
      const port = Number(val);
      if (isNaN(port)) throw new Error("PORT must be a number");
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
};
