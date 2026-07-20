import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // .env may not exist in CI/production where vars are injected directly.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
