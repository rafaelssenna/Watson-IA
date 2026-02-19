import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { Server } from "socket.io";

// Type augmentation
import "./types.js";

// Import plugins
import authenticatePlugin from "./plugins/authenticate.js";

// Import routes
import { authRoutes } from "./modules/auth/routes.js";
import { conversationRoutes } from "./modules/conversations/routes.js";
import { contactRoutes } from "./modules/contacts/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { personaRoutes } from "./modules/personas/routes.js";
import { knowledgeRoutes } from "./modules/knowledge/routes.js";
import { webhookRoutes } from "./modules/webhooks/routes.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "watson-ai-secret-key-change-me",
    sign: { expiresIn: "15m" },
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(sensible);
  await fastify.register(websocket);

  // Register authenticate decorator
  await fastify.register(authenticatePlugin);

  // Socket.IO setup
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true,
    },
  });

  // Decorate fastify with io
  fastify.decorate("io", io);

  // Socket.IO authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = fastify.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  // Socket.IO events
  io.on("connection", (socket) => {
    const user = socket.data.user;
    fastify.log.info(`Socket connected: ${user.userId} from org ${user.orgId}`);

    // Join organization room
    socket.join(`org:${user.orgId}`);

    socket.on("disconnect", () => {
      fastify.log.info(`Socket disconnected: ${user.userId}`);
    });
  });

  // Health check
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
    };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(conversationRoutes, { prefix: "/api/v1/conversations" });
  await fastify.register(contactRoutes, { prefix: "/api/v1/contacts" });
  await fastify.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  await fastify.register(personaRoutes, { prefix: "/api/v1/personas" });
  await fastify.register(knowledgeRoutes, { prefix: "/api/v1/knowledge" });
  await fastify.register(webhookRoutes, { prefix: "/api/v1/webhooks" });

  return fastify;
}

// Start server
async function start() {
  try {
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Watson API running on http://${HOST}:${PORT}`);
    server.log.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
