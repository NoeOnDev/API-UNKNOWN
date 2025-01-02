import express from "express";
import { config } from "./_config/env.config";

const app = express();
const port = config.port.PORT;

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
