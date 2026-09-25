/**
 * Block reward of Fennec mainnet (fennec/fennecblockchain.cpp GetBlockSubsidy): halving every 1,176,055 blocks. The base subsidy before
 * halving is NOT a flat number, the node special-cases the first few blocks (a height-1 premine, then a near-zero window):
 *   height == 1          : 6,300,000 FNNC
 *   height in [2, 100]    : 0
 *   height == 101         : 0.01 FNNC
 *   height in [102, 110]  : 0
 *   height >= 111 (else)  : 6.25 FNNC
 * then nSubsidy >>= halvings (integer right shift on the satoshi amount, i.e. floor division by 2^halvings).
 * Amounts in atomic units (1 FNNC = 1e8). The fees of the transactions come on top: the pool reads the exact reward of its own blocks from
 * its wallet, this is only used to estimate/display expected rewards.
 **/
const FNNC_BASE = 100000000;
const HALVING_INTERVAL = 1176055;

exports.minerReward = function (height) {
	if (!(height >= 0)) return 0;
	let halvings = Math.floor(height / HALVING_INTERVAL);
	if (halvings >= 64) return 0;

	let nSubsidy;
	if (height === 1) nSubsidy = 6300000 * FNNC_BASE;
	else if (height >= 2 && height <= 100) nSubsidy = 0;
	else if (height === 101) nSubsidy = Math.round(0.01 * FNNC_BASE);
	else if (height >= 102 && height <= 110) nSubsidy = 0;
	else nSubsidy = 6.25 * FNNC_BASE;

	// no mandatory devfee/masternode output on this chain (plain coinbase, verified against fennec/miner.cpp CreateNewBlock)
	return Math.floor(nSubsidy / Math.pow(2, halvings));
};
