import { formatNumber } from "./formatting";

describe("formatting", () => {
  describe("formatNumber", () => {
    test("should format integer numbers with commas", () => {
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    test("should format numbers with decimals", () => {
      expect(formatNumber(1000000.123456)).toBe("1,000,000.123456");
    });

    test("should limit decimal places to 6", () => {
      expect(formatNumber(1000000.1234567890123)).toBe("1,000,000.123457");
    });

    test("should handle small numbers", () => {
      expect(formatNumber(123.45)).toBe("123.45");
    });

    test("should handle zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    test("should handle negative numbers", () => {
      expect(formatNumber(-1000000)).toBe("-1,000,000");
    });

    test("should handle numbers less than 1", () => {
      expect(formatNumber(0.123456)).toBe("0.123456");
    });

    test("should use minimum 0 decimal places", () => {
      expect(formatNumber(1000000.0)).toBe("1,000,000");
    });

    test("should handle very large numbers", () => {
      expect(formatNumber(1234567890123)).toBe("1,234,567,890,123");
    });

    test("should handle numbers with trailing zeros after decimal", () => {
      expect(formatNumber(1000.100)).toBe("1,000.1");
    });
  });
});
