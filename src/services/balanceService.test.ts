import {
  calculateStakingAmount,
  shouldRestake,
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
});
