import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("mysql://"),
});

export function getDatabaseEnv() {
  const result = databaseEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error("DATABASE_URL must be a valid mysql:// URL");
  }
  return result.data;
}
