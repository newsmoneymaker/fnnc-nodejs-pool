# fnnc-nodejs-pool

Mining pool software for **Fennec (FNNC)** written in Node.js: a stratum server for Fennec's **yescrypt** proof of work (the standard Bitcoin Stratum protocol), share checking, block building from the
node's block template (a plain Bitcoin style coinbase — Fennec has no masternode/devfee output, the whole subsidy plus fees goes to the pool's own output, plus the SegWit witness commitment since
SegWit is active on this chain from genesis), block accounting through the pool wallet, and batch payouts. It is a fork of
[cryptonote-nodejs-pool](https://github.com/dvandal/cryptonote-nodejs-pool) by Dvandal (GNU GPL v2) and of its adaptations
[scash-nodejs-pool](https://github.com/newsmoneymaker/scash-nodejs-pool), [veil-nodejs-pool](https://github.com/newsmoneymaker/veil-nodejs-pool),
[qwc-nodejs-pool](https://github.com/newsmoneymaker/qwc-nodejs-pool), [c64-nodejs-pool](https://github.com/newsmoneymaker/c64-nodejs-pool) and [ytn-nodejs-pool](https://github.com/newsmoneymaker/ytn-nodejs-pool),
written for the Bitcoin-Core-based node and wallet RPC of [Fennec](https://github.com/FennecBlockchain/Fennec). Live example: <https://fnnc.pool-pay.com>.

## What it does

* **Stratum server** (plain TCP and TLS ports, Bitcoin Stratum v1 in the form yescrypt/GhostRider-family miners such as [poolpayminer](https://github.com/newsmoneymaker/poolpayminer) and
  XMRig-style miners use): the pool asks the node for a block template (`getblocktemplate`, called with `{"rules":["segwit"]}` — Fennec requires this), **builds the block itself** (a coinbase with the
  BIP34 height, the extranonce, a single pool output for the whole `coinbasevalue`, the SegWit witness commitment the template supplies; the merkle branch; the 80 byte header) and sends every miner
  `mining.notify` with a share difficulty that follows the miner's hashrate (vardiff, remembered across reconnects). It checks every share itself with a small C helper (`hasher/yphash`): the yescrypt
  hash of the header, computed with Fennec's own yescrypt sources bundled verbatim (`hasher/yescrypt/`, copied from the node's `fennec/hash/yescrypt/`, public domain / BSD-style headers per file) so the
  hash is guaranteed to match the real node exactly. A share that meets the network target is submitted to the node as a whole block with `submitblock`.
* **Fennec proof of work:** a single algorithm, **yescryptr16** — `yescrypt_kdf` with N=4096, r=16, p=1, t=0, flags `YESCRYPT_RW | YESCRYPT_PWXFORM` (note: *not* `YESCRYPT_PARALLEL_SMIX`, unlike the
  generic yescrypt PHC reference parameters), salt = password = the 80 byte header, 32 byte output read as a little-endian number, which must not be above the target
  (`fennec/primitives/block.cpp CBlockHeader::GetPoWHash()` → `fennec/hash/yescrypt/yescrypt.c yescrypt_hash()`). Difficulty retargets with DarkGravity v3. Block time about 2.5 minutes (`nPowTargetSpacing`).
* **Reward schedule** (`fennec/fennecblockchain.cpp GetBlockSubsidy`): halving every 1,176,055 blocks. The base subsidy is 6.25 FNNC, with a special-cased ramp-up at the very start of the chain
  (height 1: 6,300,000 FNNC; heights 2–100 and 102–110: 0; height 101: 0.01 FNNC) that is already long over on mainnet. Coinbase maturity is 100 blocks. No masternode/devfee output: the pool's own
  output is the entire subsidy plus fees.
* **Accounts** are Fennec addresses (`F...` for both P2PKH, version byte 35, and P2SH, version byte 36 — both prefixes happen to land on the same leading letter on this chain; base58check verified),
  optionally `.worker` or `+worker`, with a reward mode prefix `prop:` (shared, default) or `solo:`.
* **Rewards:** PROP with time weighting (slush) or SOLO.
* **Block unlocker:** a block is settled after `depth` blocks (coinbase maturity is 100). The reward is what the pool wallet received in the block's coinbase transaction (`gettransaction`);
  a block that is no longer on the chain is marked orphaned and nothing is credited.
* **Payment processor:** everyone who is due is paid in **one `sendmany` transaction per round**. The balance is debited before sending; a batch whose outcome is unknown (crash, timeout) is found
  again in the wallet by its comment and never sent twice; refused or stuck batches go back to the balances. Dry-run mode, a whitelist for rehearsals and an emergency brake (`deployment/pause-payments.sh`).
* **Website and API:** a ready website (`website_example/`) with the dashboard and its graphs, blocks, payments, top miners, worker statistics, a "Getting started" page with a config generator,
  and the public read-only JSON API.
* **Protection against connection floods:** limits per IP, a login deadline, an optional IP allow list, banning of miners with many invalid shares.
* **Tests** (`test/`): address handling, the yescrypt helper against **real Fennec mainnet blocks** (`test-real-blocks.js`), and `test-fnnc-proposal.js`, which builds a block from the template of a
  **real, synchronised node** and lets the node validate it as a block proposal (coinbase, merkle root, header fields: the node answers `null`), and refuses a block that pays one atom too much.

## Developer donation

The pool can take a **developer donation** from the reward of every block it finds, before the miners' shares are computed (`blockUnlocker.donations`, a table `Fennec address -> percent`, up to 10% per
entry; **empty by default in `config_examples/fnnc.json`**). It is your pool and the license is the GPL: set what you want and tell your miners the truth about the fees of your pool. This has nothing to do
with the miner poolpayminer (a separate project with its own fee) or with Fennec's own consensus (which has no mandatory fee at all).

## Installation

See [docs/INSTALL.md](docs/INSTALL.md): the Fennec node and wallet (build from source), the yescrypt helper, Redis, the pool services (systemd templates in
`deployment/`), the website and the first payout rehearsal.

Requirements: Linux, Node.js 18 or newer, Redis, a Fennec node (`fennecd`) synchronised with the network, a C compiler for the helper, a web server for the website and a
TLS certificate for the TLS stratum ports.

## Miners

[poolpayminer](https://github.com/newsmoneymaker/poolpayminer) (Windows and Linux, free, has its own fee) knows it as `-a yescryptr16`.
Example: `poolpayminer -a yescryptr16 --tls -o fnnc.pool-pay.com:4101 -u FYourAddress+rigname -p x -k`.

## Tests

```
npm install
node test/test-account.js                    # address handling, needs nothing else
make -C hasher                                # the yescrypt helper, needs only a C compiler
node test/test-real-blocks.js                 # the hash of real mainnet blocks, needs only the helper
node test/test-fnnc-proposal.js config.json   # needs a running, fully synchronised fennecd (config.node) and poolServer.poolAddress from its wallet
```

## Money warning

The payment processor moves real coins. Rehearse first: `"dryRun": true`, then a whitelist (`onlyAccounts`) with a few small payouts of your own, then enable it. A transaction that has been sent to the
network can not be cancelled. Keep the wallet backup (`dumpwallet` / `backupwallet`) and the RPC password private.

## License and credits

GNU GPL v2 (see LICENSE), like the original. Based on cryptonote-nodejs-pool by Dvandal and contributors. The block builder, the Bitcoin Stratum server, the yescrypt helper and the Fennec adaptation are
part of this project.
