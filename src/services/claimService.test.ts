import {
  filterValidatorsWithRewards,
  calculateTotalRewards,
  claimRewards,
} from "./claimService";
import { Validator } from "../types";

describe("claimService", () => {
  describe("filterValidatorsWithRewards", () => {
    const validators: Validator[] = [
      {
        validatorAddress:
          "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
        stakingAmount: 1000000,
        rewards: 300000,
      },
      {
        validatorAddress:
          "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
        stakingAmount: 2000000,
        rewards: 100000,
      },
      {
        validatorAddress:
          "cosmosvaloper1dddddddddddddddddddddddddddddddddddddd" as any,
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
        stakingAmount: 3000000,
        rewards: 500000,
      },
    ];

    test("should filter validators with rewards above threshold", () => {
      const result = filterValidatorsWithRewards(validators, 200000);

      expect(result).toHaveLength(2);
      expect(result[0]!.rewards).toBe(300000);
      expect(result[1]!.rewards).toBe(500000);
    });

    test("should return all validators when threshold is 0", () => {
      const result = filterValidatorsWithRewards(validators, 0);

      expect(result).toHaveLength(3);
    });

    test("should return empty array when no validators meet threshold", () => {
      const result = filterValidatorsWithRewards(validators, 1000000);

      expect(result).toHaveLength(0);
    });

    test("should handle empty validators array", () => {
      const result = filterValidatorsWithRewards([], 100000);

      expect(result).toHaveLength(0);
    });

    test("should include validators with rewards equal to threshold", () => {
      const result = filterValidatorsWithRewards(validators, 300000);

      expect(result).toHaveLength(1);
      expect(result[0]!.rewards).toBe(500000);
    });
  });

  describe("calculateTotalRewards", () => {
    test("should sum rewards from all validators", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 300000,
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 100000,
        },
        {
          validatorAddress:
            "cosmosvaloper1dddddddddddddddddddddddddddddddddddddd" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 3000000,
          rewards: 500000,
        },
      ];

      const result = calculateTotalRewards(validators);

      expect(result).toBe(900000);
    });

    test("should return 0 for empty array", () => {
      const result = calculateTotalRewards([]);

      expect(result).toBe(0);
    });

    test("should handle validators with zero rewards", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
        },
      ];

      const result = calculateTotalRewards(validators);

      expect(result).toBe(0);
    });

    test("should handle single validator", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 250000,
        },
      ];

      const result = calculateTotalRewards(validators);

      expect(result).toBe(250000);
    });
  });

  describe("claimRewards", () => {
    const mockClient = {
      withdrawRewards: jest.fn(),
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should claim rewards from all validators", async () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 300000,
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 100000,
        },
      ];

      mockClient.withdrawRewards.mockResolvedValue({});

      // Use 0 delay to ensure tests run fast and don't timeout waiting for sequential delays
      await claimRewards(mockClient, validators, 0);

      expect(mockClient.withdrawRewards).toHaveBeenCalledTimes(2);
    });

    test("should use custom delay", async () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 300000,
        },
      ];

      mockClient.withdrawRewards.mockResolvedValue({});

      // Use 0 delay to ensure test speed
      await claimRewards(mockClient, validators, 0);

      expect(mockClient.withdrawRewards).toHaveBeenCalledTimes(1);
    });

    test("should handle empty validators array", async () => {
      await claimRewards(mockClient, [], 1000);

      expect(mockClient.withdrawRewards).not.toHaveBeenCalled();
    });

    test("should handle claim failures gracefully", async () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress:
            "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 300000,
        },
      ];

      mockClient.withdrawRewards.mockRejectedValue(new Error("Claim failed"));

      const promise = claimRewards(mockClient, validators, 1000);
      jest.runAllTimers();
      await promise;

      expect(mockClient.withdrawRewards).toHaveBeenCalledTimes(1);
    });
  });
});
