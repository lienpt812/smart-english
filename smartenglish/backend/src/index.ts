import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;

createApp()
  .then((app) => {
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
      console.log(`Swagger UI: http://localhost:${port}/api/docs`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
