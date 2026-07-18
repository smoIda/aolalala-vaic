import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  database: new Pool({
    connectionString:
      process.env.BACKOFFICE_DATABASE_URL ??
      "postgres://backoffice:backoffice@localhost:15434/backoffice",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
