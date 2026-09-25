# Installing a Fennec pool

Paths below are examples: the pool in `/opt/fnnc-nodejs-pool`, the node and its data in `/opt/fnnc`, all run by the user `fnncpool`
(the systemd templates in `deployment/systemd/` use these paths).

## 1. Fennec node and wallet

Fennec Core (`https://github.com/FennecBlockchain/Fennec`, branch `main`, MIT) is a fairly recent Bitcoin-Core-based node (SegWit, PSBT, descriptor wallet support present in the code). It uses its own
`deps` (not `depends`) autotools-based dependency build system and builds fine on a plain Debian 10/11/12 host with a C++11-capable GCC and Boost — no cross-chroot or patch was needed for this
build.

```
git clone https://github.com/FennecBlockchain/Fennec && cd Fennec
# build dependencies: curl build-essential libtool autotools-dev automake pkg-config python3 bsdmainutils patch bison xz-utils unzip
make -C deps NO_QT=1 NO_UPNP=1 NO_NATPMP=1 NO_ZMQ=1 -j4
./autogen.sh
CONFIG_SITE=$PWD/deps/x86_64-pc-linux-gnu/share/config.site ./configure --prefix=/ --without-gui --disable-tests --disable-bench --with-incompatible-bdb --disable-man
make -j4                                                    # fennec/fennecd, fennec/fennec-cli
```

`/opt/fnnc/data/fennec.conf`:

```
server=1
listen=1
daemon=0
rpcuser=fnncpool
rpcpassword=<a long random password>
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=8339
port=8338
maxconnections=40
dbcache=1024
addnode=seed1.fennecblockchain.com
addnode=seed2.fennecblockchain.com
addnode=seed3.fennecblockchain.com
addnode=seed4.fennecblockchain.com
```

The project's GitHub releases ship the GUI wallet apps (Linux/Mac/Windows), not a chain-data snapshot, so **sync from the P2P network** (`fennecd -datadir=... -conf=...`); track progress with
`fennec-cli getblockchaininfo` (`blocks` vs `headers`). `getblocktemplate` (and hence the pool) only works once the node is out of initial block download. **Fennec needs `getblocktemplate` with the
segwit rule** (`{"rules":["segwit"]}`, since SegWit is active on this chain from block 0), which the pool does.

The default wallet of the node is the pool wallet:

```
fennec-cli getnewaddress "pool"          # F... : the pool address (poolServer.poolAddress)
fennec-cli dumpwallet /safe/place/fnnc-wallet-dump.txt   # the private keys: keep it offline, chmod 600 (also: fennec-cli backupwallet <file>)
```

**No mandatory extra coinbase output.** Unlike some other chains in this pool family, Fennec's consensus (`fennec/fennecblockchain.cpp GetBlockSubsidy`, `fennec/miner.cpp CreateNewBlock`) has no
masternode/devfee/founder payment requirement: the coinbase is a single output for the whole subsidy plus fees (to the pool), plus the SegWit witness commitment output the template supplies. Verify
this yourself by reading those two functions before trusting it on a fork.

## 2. yescrypt helper

The helper (`hasher/yphash`) is a tiny C program around Fennec's own yescrypt sources, copied verbatim from the node's `fennec/hash/yescrypt/` into `hasher/yescrypt/` (its own repo, BSD-style
per-file headers): `cd hasher && make` (needs only a C compiler; `STATIC=-static` for a binary that runs anywhere). Check it against the chain: `node test/test-real-blocks.js`. `hasher.threads`
helper processes work in parallel (each share is one hash).

## 3. Redis

Use a dedicated instance with a password and AOF (`deployment/redis-pool.conf.example`, unit `fnnc-pool-redis`, port 6389).

## 4. The pool

```
cd /opt/fnnc-nodejs-pool && npm install --production
cp config_examples/fnnc.json config.json      # then edit it
```

Edit `config.json`: `poolHost`, `poolServer.poolAddress` (the wallet address of step 1), the ports and the certificate for TLS (`poolServer.sslCert/sslKey`), `redis`, `api.password`,
`node.password` or `node.passwordFile`, `blockUnlocker.poolFee` and `donations`, `payments`. **Keep `payments.dryRun: true` until the rehearsal below.**

```
cp deployment/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now fnnc-pool-redis fnnc-node
systemctl enable --now fnnc-pool fnnc-pool-api fnnc-pool-unlocker fnnc-pool-payments fnnc-pool-charts
node test/test-fnnc-proposal.js config.json        # the node itself validates a block built by the pool (needs the fully synchronised node)
```

The pool runs as separate modules (`init.js -module=pool|api|unlocker|payments|chartsDataCollector`), each in its own unit. Until payouts are proven, restrict the stratum ports with `poolServer.allowIPs`.
Point a miner at it: `poolpayminer -a yescryptr16 -o your.pool:4100 -u <an F... address> -p x`.

## 5. Website

Copy `website_example/` to the web root, set `poolHost`, the contact and links in `config.js`, and proxy `/api` to the pool API on 127.0.0.1:8127 (`deployment/apache-vhost.conf.example` exposes only the
read-only methods).

## 6. Rehearse the payments

1. `payments.dryRun: true`: the log of `fnnc-pool-payments` shows what would be paid.
2. Fund the pool wallet with a few coins (or wait for the first block), credit a small balance in Redis to your own test addresses (`<coin>:workers:<address>`, field `balance`), set `payments.onlyAccounts`
   to them, `dryRun: false`, and watch the payout confirm.
3. Remove the test accounts from Redis and set `onlyAccounts` to `[]`.

Good to know: block rewards can be spent after 100 blocks (about 4 hours at ~2.5 minute blocks); `deployment/pause-payments.sh` stops new payouts at once; the wallet must stay unlocked and online for the
payouts (leave the pool wallet unencrypted with only small balances in it). Of a block the pool gets the whole subsidy plus fees — there is no mandatory extra output to subtract.
