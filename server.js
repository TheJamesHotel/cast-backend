import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db/database.js";

import tvRoutes from "./routes/tvRoutes.js";
import pairRoutes from "./routes/pairRoutes.js";
import webRoutes from "./routes/webRoutes.js";
import displayRoutes from "./routes/displayRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/tv", tvRoutes);
app.use("/api/pair", pairRoutes);
app.use("/", webRoutes);
app.use("/", displayRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});