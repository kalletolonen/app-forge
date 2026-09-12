import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const appSlug = process.env.APP_ID ?? "demo";
const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: join(packageRoot, "src/schema.ts"),
  out: join(packageRoot, "migrations"),
  dialect: "sqlite",
  dbCredentials: {
    url:
      process.env.LOCAL_DATABASE_URL ??
      `file:${join(process.cwd(), ".data", `${appSlug}.sqlite`)}`,
  },
});
