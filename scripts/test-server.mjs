import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.js";
const directory = mkdtempSync(join(tmpdir(), "gym-browser-"));
const { app, db } = createApp({ dbPath: join(directory, "test.sqlite") });
const server = app.listen(4173, "127.0.0.1");
function close() {
  server.close(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
