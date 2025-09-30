import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";

/**
 * Creates a wallet from a mnemonic
 */
export async function createWallet(
  mnemonic: string,
  prefix: string
): Promise<DirectSecp256k1HdWallet> {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
}

/**
 * Gets all accounts from a wallet
 */
export async function getAccounts(
  wallet: DirectSecp256k1HdWallet
): Promise<string[]> {
  const accounts = await wallet.getAccounts();
  return accounts.map((account) => account.address);
}

/**
 * Connects to a Cosmos chain with a signing wallet
 */
export async function connectWithSigner(
  rpcUrl: string,
  wallet: DirectSecp256k1HdWallet,
  gasPrice: string
): Promise<SigningStargateClient> {
  return SigningStargateClient.connectWithSigner(rpcUrl, wallet, {
    gasPrice: GasPrice.fromString(gasPrice),
  });
}
