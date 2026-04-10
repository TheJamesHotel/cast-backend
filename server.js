import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import "./db/database.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("ok"));
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});