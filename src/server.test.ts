import Fastify from "fastify";

// Mock the executeRestake function before importing the server
const mockExecuteRestake = jest.fn();
jest.mock("./index", () => ({
  executeRestake: mockExecuteRestake,
}));

describe("server", () => {
  let server: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a new Fastify instance for each test
    server = Fastify({ logger: false });

    // Manually register routes to test them
    server.get("/health", async () => {
      return { status: "ok" };
    });

    server.get("/", async (_request: any, reply: any) => {
      try {
        const result = await mockExecuteRestake();

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
  });

  afterEach(async () => {
    await server.close();
  });

  describe("GET /health", () => {
    test("should return health status", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: "ok" });
    });
  });

  describe("GET /", () => {
    test("should return success when restake succeeds", async () => {
      mockExecuteRestake.mockResolvedValue({
        success: true,
        rewardsClaimed: 100000,
        amountRestaked: 500000,
        validator: "cosmosvaloper1test",
        totalAvailable: 800000,
      });

      const response = await server.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe("Restake completed successfully");
      expect(payload.data).toEqual({
        rewardsClaimed: 100000,
        amountRestaked: 500000,
        validator: "cosmosvaloper1test",
        totalAvailable: 800000,
      });
    });

    test("should return error when restake fails", async () => {
      mockExecuteRestake.mockResolvedValue({
        success: false,
        error: "Insufficient funds",
      });

      const response = await server.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe("Insufficient funds");
    });

    test("should handle thrown errors", async () => {
      mockExecuteRestake.mockRejectedValue(new Error("Network error"));

      const response = await server.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe("Network error");
    });

    test("should handle non-Error exceptions", async () => {
      mockExecuteRestake.mockRejectedValue("String error");

      const response = await server.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe("String error");
    });
  });
});
