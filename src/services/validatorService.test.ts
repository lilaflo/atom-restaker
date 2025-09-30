import {
  filterActiveValidators,
  findLowestStakingValidator,
  enrichValidatorsWithMetadata,
} from "./validatorService";
import { Validator } from "../types";
import * as utils from "../utils";

jest.mock("../utils");

describe("validatorService", () => {
  describe("filterActiveValidators", () => {
    test("should filter out jailed validators", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
          jailed: true,
          status: "BOND_STATUS_BONDED",
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 0,
          jailed: false,
          status: "BOND_STATUS_BONDED",
        },
      ];

      const result = filterActiveValidators(validators);

      expect(result).toHaveLength(1);
      expect(result[0]!.validatorAddress).toBe(
        "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc"
      );
    });

    test("should filter out inactive validators", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
          jailed: false,
          status: "BOND_STATUS_UNBONDED",
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 0,
          jailed: false,
          status: "BOND_STATUS_BONDED",
        },
      ];

      const result = filterActiveValidators(validators);

      expect(result).toHaveLength(1);
      expect(result[0]!.validatorAddress).toBe(
        "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc"
      );
    });

    test("should return only active and bonded validators", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
          jailed: false,
          status: "BOND_STATUS_BONDED",
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 0,
          jailed: false,
          status: "BOND_STATUS_BONDED",
        },
      ];

      const result = filterActiveValidators(validators);

      expect(result).toHaveLength(2);
    });

    test("should handle empty validators array", () => {
      const result = filterActiveValidators([]);

      expect(result).toHaveLength(0);
    });

    test("should handle validators without jailed or status fields", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
        },
      ];

      const result = filterActiveValidators(validators);

      expect(result).toHaveLength(0);
    });
  });

  describe("findLowestStakingValidator", () => {
    test("should find validator with lowest staking amount", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 3000000,
          rewards: 0,
        },
        {
          validatorAddress:
            "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
        },
        {
          validatorAddress:
            "cosmosvaloper1dddddddddddddddddddddddddddddddddddddd" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 2000000,
          rewards: 0,
        },
      ];

      const result = findLowestStakingValidator(validators);

      expect(result.validatorAddress).toBe(
        "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc"
      );
      expect(result.stakingAmount).toBe(1000000);
    });

    test("should return single validator when array has one element", () => {
      const validators: Validator[] = [
        {
          validatorAddress:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
          delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
          stakingAmount: 1000000,
          rewards: 0,
        },
      ];

      const result = findLowestStakingValidator(validators);

      expect(result).toEqual(validators[0]);
    });

    test("should throw error for empty array", () => {
      expect(() => findLowestStakingValidator([])).toThrow(
        "No validators provided"
      );
    });

    test("should handle validators with equal staking amounts", () => {
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
          stakingAmount: 1000000,
          rewards: 0,
        },
      ];

      const result = findLowestStakingValidator(validators);

      expect(result.stakingAmount).toBe(1000000);
    });
  });

  describe("enrichValidatorsWithMetadata", () => {
    const mockValidators: Validator[] = [
      {
        validatorAddress:
          "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as any,
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any,
        stakingAmount: 1000000,
        rewards: 0,
      },
    ];

    const lcdEndpoints = ["https://api.cosmos.network"];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should enrich validators with metadata", async () => {
      (utils.fetchWithTimeout as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({
          validator: {
            operator_address:
              "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            jailed: false,
            status: "BOND_STATUS_BONDED",
            tokens: "1000000",
            delegator_shares: "1000000",
            description: {
              moniker: "Test Validator",
            },
            commission: {
              commission_rates: {
                rate: "0.05",
              },
            },
          },
        }),
      });

      (utils.returnFirst as jest.Mock).mockResolvedValue({
        validator: {
          operator_address:
            "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          jailed: false,
          status: "BOND_STATUS_BONDED",
          tokens: "1000000",
          delegator_shares: "1000000",
          description: {
            moniker: "Test Validator",
          },
          commission: {
            commission_rates: {
              rate: "0.05",
            },
          },
        },
      });

      const result = await enrichValidatorsWithMetadata(
        mockValidators,
        lcdEndpoints
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.jailed).toBe(false);
      expect(result[0]!.status).toBe("BOND_STATUS_BONDED");
      expect(result[0]!.commission).toBe(0.05);
    });

    test("should handle fetch errors gracefully", async () => {
      (utils.returnFirst as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const result = await enrichValidatorsWithMetadata(
        mockValidators,
        lcdEndpoints
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.jailed).toBe(false);
      expect(result[0]!.status).toBe("UNKNOWN");
      expect(result[0]!.commission).toBe(0);
    });

    test("should handle empty validators array", async () => {
      const result = await enrichValidatorsWithMetadata([], lcdEndpoints);

      expect(result).toHaveLength(0);
    });
  });
});
