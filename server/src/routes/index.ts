import { Router } from "express";
import { authRouter } from "./auth.routes";
import { meRouter } from "./me.routes";
import { episodesRouter } from "./episodes.routes";
import { discoverRouter } from "./discover.routes";
import { audioRouter } from "./audio.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "practicalpodcast", time: new Date().toISOString() });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/", meRouter);
apiRouter.use("/episodes", episodesRouter);
apiRouter.use("/", discoverRouter);
apiRouter.use("/audio", audioRouter);
