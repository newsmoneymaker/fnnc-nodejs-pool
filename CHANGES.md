# Changes

## 1.0.0

* First release: Fennec (FNNC, yescryptr16 — `yescrypt_kdf` N=4096 r=16 p=1 t=0, flags `YESCRYPT_RW | YESCRYPT_PWXFORM`) pool derived from scash-nodejs-pool, veil-nodejs-pool, qwc-nodejs-pool,
  c64-nodejs-pool and ytn-nodejs-pool.
* The pool builds the blocks itself from `getblocktemplate` (called with the segwit rule; `lib/blockBuilder.js`): a plain coinbase (BIP34 height, extranonce, a single pool output for the whole
  `coinbasevalue` — Fennec's node has no masternode/devfee output to replicate, unlike some sibling chains — the witness commitment if present), the merkle branch and the 80 byte header; a
  solved block is sent with `submitblock`.
* `lib/pool.js` speaks Bitcoin Stratum v1 (prevhash with every 4 byte word reversed, version / ntime / nbits big endian, the nonce as the hex of the number, extranonce1 of
  4 bytes and extranonce2 of 4 bytes). Job ids are per miner (`<job>.<n>`) and carry the difficulty of that miner: the miner applies a new difficulty with its next job.
* `hasher/yphash` is a small C program around Fennec's own yescrypt sources bundled verbatim (`hasher/yescrypt/`, copied from the node's `fennec/hash/yescrypt/`): `make -C hasher`, no other
  dependency.
* Payments and unlocker as in Bitcoin based pools (`sendmany`, `gettransaction`, coinbase maturity 100), base58 addresses (`F...` for both P2PKH and P2SH on this chain).
* The variable difficulty of a worker is remembered across reconnects (`poolServer.diffMemoryMinutes`, default 15).
* Tests: address handling, the yescryptr16 hash of real mainnet blocks, and a block built by the pool from a real node's template validated by that node as a proposal.
* Not yet checked on a block found on mainnet: the payout with the real wallet (`sendmany` with `subtractfeefrom`).
