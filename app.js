import express from "express";
import userRouter from "./routes/userRoutes.js";
import eventRouter from "./routes/eventRoutes.js";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import AppError from "./utils/appError.js";
import globalErrorHandler from "./controllers/errorController.js";

const app = express();

app.set("trust proxy", 1);

app.use(cookieParser());

app.use(helmet());

app.use(
  cors({
    origin: ["http://localhost:3000", "https://eventify-woad-seven.vercel.app"],
    credentials: true,
  }),
);

// Limit requests from the same IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10000, // Limit each IP to 10,000 requests per windowMs
  message: "Too many requests from this IP, please try again in an hour!",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiter to all API routes
app.use("/api", limiter);

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body parser, reading data from the body into req.body
app.use(express.json({ limit: "10kb" }));

// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
  mongoSanitize.sanitize(req.body);
  mongoSanitize.sanitize(req.params);

  const queryCopy = { ...req.query };
  mongoSanitize.sanitize(queryCopy);
  req.querySanitized = queryCopy;

  next();
});

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/events", eventRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Just for testing",
  });
});

// Handle unknown routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
