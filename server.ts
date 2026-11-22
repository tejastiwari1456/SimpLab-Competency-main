import "dotenv/config";
import http from "http";
import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app } from "./src/server/app";
import { setupPairLabWebSockets } from "./pairLabServer";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const server = http.createServer(app);

  // Attach real-time Pair Lab WebSockets (REST endpoints are mounted in src/server/app.ts)
  setupPairLabWebSockets(server);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === "true" ? null : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.on("error", (err) => {
    console.error("[SimLab] HTTP server error:", err);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SimLab] Full-stack server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SimLab] Fatal error while starting server:", err);
  process.exit(1);
});
