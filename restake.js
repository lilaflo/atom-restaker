require('dotenv').config();
const {
  DirectSecp256k1HdWallet,
} = require('@cosmjs/proto-signing');
const {
  assertIsDeliverTxSuccess,
  SigningStargateClient,
} = require('@cosmjs/stargate');
const { GasPrice } = require('@cosmjs/stargate');

const { MNEMONIC, RPC_URL, DELEGATOR_ADDRESS } = process.env;
const DENOM = 'uatom';
const RESERVE = 1_000_000; // 1 ATOM in uatom
const MIN_STAKE_AMOUNT = 500_000;


async function main() {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'cosmos' });
  const [account] = await wallet.getAccounts();
  const gasPrice = GasPrice.fromString("0.025uatom");
  const client = await SigningStargateClient.connectWithSigner(RPC_URL, wallet, { gasPrice });

  console.log(`🚀 Verbunden mit ${account.address}`);

  // 1. Aktive Delegationen abrufen
  let delegations = await client.queryClient.staking.delegatorDelegations(DELEGATOR_ADDRESS);
  if (!delegations.delegationResponses || delegations.delegationResponses.length === 0) {
    console.log('❌ Keine Delegationen gefunden.');
    return;
  }

  // 2. Für jeden Validator Rewards claimen (sequentiell)
  console.log("📥 Claiming rewards sequentially...");
  const results = [];
  for (const d of delegations.delegationResponses) {
    const validator = d.delegation.validatorAddress;
    try {
      const tx = await client.withdrawRewards(
        DELEGATOR_ADDRESS,
        validator,
        "auto",
        "auto"
      );
      assertIsDeliverTxSuccess(tx);
      console.log(`✅ Rewards erfolgreich geclaimt von ${validator}`);
      results.push({ success: true, validator });
    } catch (err) {
      console.error(`⚠️ Fehler beim Claimen von ${validator}:`, err.message);
      results.push({ success: false, validator, error: err.message });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`📊 Rewards claiming completed: ${successful} successful, ${failed} failed`);

  // 2. Guthaben abfragen
  const balances = await client.getAllBalances(DELEGATOR_ADDRESS);
  const atomBalance = parseInt(balances.find(b => b.denom === DENOM)?.amount || '0');
  const stakeAmount = atomBalance - RESERVE;
  if (stakeAmount <= 0) {
    console.log('❌ Nicht genug ATOM zum Re-Staken verfügbar.');
    return;
  }
  if (stakeAmount < MIN_STAKE_AMOUNT) {
    console.log(`⏸️ Stake-Betrag ${stakeAmount} uatom ist kleiner als 1 ATOM. Vorgang abgebrochen.`);
    return;
  }

  // 3. Liste deiner aktiven Delegationen abrufen
  delegations = await client.queryClient.staking.delegatorDelegations(DELEGATOR_ADDRESS);
  if (!delegations.delegationResponses || delegations.delegationResponses.length === 0) {
    console.log('❌ Keine Delegationen gefunden.');
    return;
  }

  // Get delegator with the min balance
  let minDelegation = delegations.delegationResponses[0];
  for (const d of delegations.delegationResponses) {
    if (BigInt(d.balance.amount) < BigInt(minDelegation.balance.amount)) {
      minDelegation = d;
    }
  }

  const targetValidator = minDelegation.delegation.validatorAddress;
  console.log("Target Validator:", targetValidator);
  console.log("Min Delegation:", minDelegation);

  // 4. Delegieren
  console.log(`📤 Delegiere ${stakeAmount} uatom an Validator ${targetValidator}`);
  const delegateTx = await client.delegateTokens(
    DELEGATOR_ADDRESS,
    targetValidator,
    { denom: DENOM, amount: `${stakeAmount}` },
    "auto",
    "auto"
  );
  assertIsDeliverTxSuccess(delegateTx);
  console.log('✅ Erfolgreich restaked.');

  client.disconnect();
}

main().catch(e => {
  console.error('❌ Fehler:', e.message);
});