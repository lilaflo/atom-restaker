import {
  calculateStakingAmount,
  shouldRestake,
  getTotalAvailableBalance,
} from "./balanceService";

describe("balanceService", () => {
  describe("calculateStakingAmount", () => {
    test("should calculate staking amount after reserve", () => {
      const result = calculateStakingAmount(1000000, 300000);

      expect(result).toBe(700000);
    });

    test("should handle zero reserve", () => {
      const result = calculateStakingAmount(1000000, 0);

      expect(result).toBe(1000000);
    });

    test("should handle reserve equal to total", () => {
      const result = calculateStakingAmount(500000, 500000);

      expect(result).toBe(0);
    });

    test("should handle negative result when reserve > total", () => {
      const result = calculateStakingAmount(300000, 500000);

      expect(result).toBe(-200000);
    });
  });

  describe("shouldRestake", () => {
    test("should return true when balance exceeds threshold", () => {
      const result = shouldRestake(2000000, 800000, 300000);

      expect(result).toBe(true);
    });

    test("should return false when balance is below threshold", () => {
      const result = shouldRestake(500000, 800000, 300000);

      expect(result).toBe(false);
    });

    test("should return true when balance equals threshold", () => {
      const result = shouldRestake(1100000, 800000, 300000);

      expect(result).toBe(true);
    });

    test("should handle zero values", () => {
      const result = shouldRestake(0, 800000, 300000);

      expect(result).toBe(false);
    });

    test("should handle edge case with minimal amounts", () => {
      const result = shouldRestake(1100001, 800000, 300000);

      expect(result).toBe(true);
    });
  });

  describe("getTotalAvailableBalance", () => {
    const mockClient = {
      getBalance: jest.fn(),
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should sum balances from multiple accounts", async () => {
      mockClient.getBalance
        .mockResolvedValueOnce({ amount: "1000000" })
        .mockResolvedValueOnce({ amount: "2000000" })
        .mockResolvedValueOnce({ amount: "500000" });

      const accounts = [
        "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "cosmos1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "cosmos1cccccccccccccccccccccccccccccccccccccc",
      ];

      const result = await getTotalAvailableBalance(
        mockClient,
        accounts,
        "uatom"
      );

      expect(result).toBe(3500000);
      expect(mockClient.getBalance).toHaveBeenCalledTimes(3);
    });

    test("should handle single account", async () => {
      mockClient.getBalance.mockResolvedValue({ amount: "1000000" });

      const accounts = ["cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"];

      const result = await getTotalAvailableBalance(
        mockClient,
        accounts,
        "uatom"
      );

      expect(result).toBe(1000000);
      expect(mockClient.getBalance).toHaveBeenCalledTimes(1);
    });

    test("should handle empty accounts array", async () => {
      const result = await getTotalAvailableBalance(mockClient, [], "uatom");

      expect(result).toBe(0);
      expect(mockClient.getBalance).not.toHaveBeenCalled();
    });

    test("should handle zero balances", async () => {
      mockClient.getBalance
        .mockResolvedValueOnce({ amount: "0" })
        .mockResolvedValueOnce({ amount: "0" });

      const accounts = [
        "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "cosmos1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ];

      const result = await getTotalAvailableBalance(
        mockClient,
        accounts,
        "uatom"
      );

      expect(result).toBe(0);
    });

    test("should call getBalance with correct parameters", async () => {
      mockClient.getBalance.mockResolvedValue({ amount: "1000000" });

      const accounts = ["cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"];
      const denom = "uatom";

      await getTotalAvailableBalance(mockClient, accounts, denom);

      expect(mockClient.getBalance).toHaveBeenCalledWith(accounts[0], denom);
    });
  });
});
