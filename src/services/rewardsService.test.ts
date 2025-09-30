import { calculateRewardAmount, enrichValidatorsWithRewards } from "./rewardsService";
import { Validator } from "../types";
import * as utils from "../utils";

jest.mock("../utils");

describe("rewardsService", () => {
  describe("calculateRewardAmount", () => {
    test("should calculate total rewards for matching denom", () => {
      const rewardsResponse = {
        rewards: [
          { denom: "uatom", amount: "1000" },
          { denom: "uatom", amount: "2000" },
          { denom: "uosmo", amount: "5000" },
        ],
      };

      const result = calculateRewardAmount(rewardsResponse, "uatom");

      expect(result).toBe(3000);
    });

    test("should return 0 for non-matching denom", () => {
      const rewardsResponse = {
        rewards: [
          { denom: "uatom", amount: "1000" },
          { denom: "uatom", amount: "2000" },
        ],
      };

      const result = calculateRewardAmount(rewardsResponse, "uosmo");

      expect(result).toBe(0);
    });

    test("should handle empty rewards array", () => {
      const rewardsResponse = {
        rewards: [],
      };

      const result = calculateRewardAmount(rewardsResponse, "uatom");

      expect(result).toBe(0);
    });

    test("should handle decimal amounts", () => {
      const rewardsResponse = {
        rewards: [
          { denom: "uatom", amount: "1000.5" },
          { denom: "uatom", amount: "2000.3" },
        ],
      };

      const result = calculateRewardAmount(rewardsResponse, "uatom");

      expect(result).toBeCloseTo(3000.8, 1);
    });
  });

  describe("enrichValidatorsWithRewards", () => {
    const mockValidators: Validator[] = [
      {
        validatorAddress: "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
        stakingAmount: 1000000,
        rewards: 0,
      },
    ];

    const lcdEndpoints = ["https://api.cosmos.network"];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should enrich validators with reward information", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "5000" }],
        }),
      };

      (utils.fetchWithTimeout as jest.Mock).mockResolvedValue(mockResponse);
      (utils.returnFirst as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          rewards: [{ denom: "uatom", amount: "5000" }],
        })
      );

      const result = await enrichValidatorsWithRewards(
        mockValidators,
        lcdEndpoints,
        "uatom"
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.rewards).toBe(5000);
    });

    test("should handle fetch errors gracefully", async () => {
      (utils.returnFirst as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const result = await enrichValidatorsWithRewards(
        mockValidators,
        lcdEndpoints,
        "uatom"
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.rewards).toBe(0);
    });

    test("should process multiple validators", async () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 0,
        },
      ];

      (utils.returnFirst as jest.Mock)
        .mockResolvedValueOnce({
          rewards: [{ denom: "uatom", amount: "3000" }],
        })
        .mockResolvedValueOnce({
          rewards: [{ denom: "uatom", amount: "7000" }],
        });

      const result = await enrichValidatorsWithRewards(
        validators,
        lcdEndpoints,
        "uatom"
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.rewards).toBe(3000);
      expect(result[1]!.rewards).toBe(7000);
    });

    test("should handle empty validators array", async () => {
      const result = await enrichValidatorsWithRewards(
        [],
        lcdEndpoints,
        "uatom"
      );

      expect(result).toHaveLength(0);
    });
  });
});
