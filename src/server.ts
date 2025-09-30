import Fastify from "fastify";
import { executeRestake } from "./index";

const server = Fastify({
  logger: true,
});

// Health check endpoint
server.get("/health", async () => {
  return { status: "ok" };
});

// Main restake endpoint
server.get("/", async (_request, reply) => {
  try {
    const result = await executeRestake();

    if (result.success) {
      return reply.code(200).send({
        success: true,
        message: "Restake completed successfully",
        data: {
          rewardsClaimed: result.rewardsClaimed,
          amountRestaked: result.amountRestaked,
          validator: result.validator,
          totalAvailable: result.totalAvailable,
        },
      });
    } else {
      return reply.code(500).send({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(500).send({
      success: false,
      error: message,
    });
  }
});

const start = async () => {
  try {
    const port = Number(process.env["PORT"]) || 8080;
    const host = process.env["HOST"] || "0.0.0.0";
    await server.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();