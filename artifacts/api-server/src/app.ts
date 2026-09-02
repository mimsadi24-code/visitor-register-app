import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin.split(",").map((value) => value.trim()).filter(Boolean) }
      : undefined,
  ),
);
// Keep request bodies intentionally small for this simple register API.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api", router);

// Return consistent JSON errors instead of Express HTML error pages.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  req.log.error({ err }, "Unhandled API error");
  if (res.headersSent) return;

  const status =
    typeof err === "object" && err !== null && "status" in err &&
    typeof err.status === "number" && err.status >= 400 && err.status < 500
      ? err.status
      : 500;

  if (status === 400) {
    res.status(status).json({ error: "Invalid request body" });
    return;
  }

  if (status === 413) {
    res.status(status).json({ error: "Request body is too large" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

export default app;
