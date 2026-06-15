import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`PracticalPodcast server listening on http://localhost:${env.PORT}`);
  console.log(`Frontend (mockups) served at http://localhost:${env.PORT}/`);
});
