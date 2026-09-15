import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const app: express.Express = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (_request, response) => {
	response.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
	logger.info({ port }, "API server listening");
});

export default app;
