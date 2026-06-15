import express from "express";
import cookieParser from "cookie-parser";
import { PATHS } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // All JSON/REST endpoints live under /api.
  app.use("/api", apiRouter);

  // Any unmatched /api route is a JSON 404 (not a static-file lookup).
  app.use("/api", notFoundHandler);

  // Everything else is the static frontend (the existing mockups).
  app.use(
    express.static(PATHS.mockups, {
      extensions: ["html"],
      index: "index.html",
    })
  );

  app.use(errorHandler);
  return app;
}
