export const PORT: number;

export function loadConfig(environment?: Record<string, string | undefined>): {
  port: number;
};
