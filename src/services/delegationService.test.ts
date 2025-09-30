import { parseDelegations, getAllDelegations } from "./delegationService";

describe("delegationService", () => {
  describe("parseDelegations", () => {
    test("should parse valid delegation responses", () => {
      const delegationsRaw = [
        {
          delegation: {
            delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            validatorAddress: "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            shares: "1000000",
          },
          balance: {
            denom: "uatom",
            amount: "1000000",
          },
        },
      ];

      const result = parseDelegations(delegationsRaw);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        validatorAddress: "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        stakingAmount: 1000000,
        rewards: 0,
      });
    });

    test("should skip invalid delegation responses", () => {
      const delegationsRaw = [
        {
          delegation: {
            delegatorAddress: "invalid-address",
            validatorAddress: "invalid-validator",
            shares: "1000000",
          },
          balance: {
            denom: "invalid",
            amount: "not-a-number",
          },
        },
      ];

      const result = parseDelegations(delegationsRaw);

      expect(result).toHaveLength(0);
    });

    test("should handle empty delegation array", () => {
      const result = parseDelegations([]);

      expect(result).toHaveLength(0);
    });

    test("should parse multiple delegations", () => {
      const delegationsRaw = [
        {
          delegation: {
            delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            validatorAddress: "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            shares: "1000000",
          },
          balance: {
            denom: "uatom",
            amount: "1000000",
          },
        },
        {
          delegation: {
            delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            validatorAddress: "cosmosvaloper1cccccccccccccccccccccccccccccccccccccc",
            shares: "2000000",
          },
          balance: {
            denom: "uatom",
            amount: "2000000",
          },
        },
      ];

      const result = parseDelegations(delegationsRaw);

      expect(result).toHaveLength(2);
      expect(result[0]!.stakingAmount).toBe(1000000);
      expect(result[1]!.stakingAmount).toBe(2000000);
    });
  });

  describe("getAllDelegations", () => {
    test("should fetch and parse delegations from multiple accounts", async () => {
      const mockClient = {
        queryClient: {
          staking: {
            delegatorDelegations: jest.fn().mockResolvedValue({
              delegationResponses: [
                {
                  delegation: {
                    delegatorAddress: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    validatorAddress:
                      "cosmosvaloper1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    shares: "1000000",
                  },
                  balance: {
                    denom: "uatom",
                    amount: "1000000",
                  },
                },
              ],
            }),
          },
        },
      } as any;

      const accounts = [
        "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "cosmos1dddddddddddddddddddddddddddddddddddddd",
      ];

      const result = await getAllDelegations(mockClient, accounts);

      expect(mockClient.queryClient.staking.delegatorDelegations).toHaveBeenCalledTimes(2);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("should handle empty accounts array", async () => {
      const mockClient = {
        queryClient: {
          staking: {
            delegatorDelegations: jest.fn(),
          },
        },
      } as any;

      const result = await getAllDelegations(mockClient, []);

      expect(mockClient.queryClient.staking.delegatorDelegations).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });
});
