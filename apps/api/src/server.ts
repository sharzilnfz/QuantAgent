import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

app
  .listen({ port: config.API_PORT, host: "0.0.0.0" })
  .then((addr) => app.log.info(`API listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
