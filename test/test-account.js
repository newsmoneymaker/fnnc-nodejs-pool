// Unit checks of the Fennec address handling (base58check P2PKH version 35 and P2SH version 36 — both happen to produce "F..." addresses on this chain). Run: node test/test-account.js
const path = require('path');
const crypto = require('crypto');
global.config = {};
const u = require(path.join(__dirname, '../lib/utils.js'));

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256d = b => crypto.createHash('sha256').update(crypto.createHash('sha256').update(b).digest()).digest();
function makeAddress (version, hash160) {
	const payload = Buffer.concat([Buffer.from([version]), hash160]);
	const raw = Buffer.concat([payload, sha256d(payload).slice(0, 4)]);
	let n = BigInt('0x' + raw.toString('hex')), s = '';
	while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
	for (const b of raw) { if (b === 0) s = '1' + s; else break; }
	return s;
}

const h160 = Buffer.from('861a1128c59794d14b12dd5f1dca9eb0267e69e6', 'hex');       // an arbitrary hash160
const OK = makeAddress(35, h160);
let failed = 0;
function check (name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failed++; }

check('a P2PKH address starts with F', OK[0] === 'F' && OK.length === 34);
// FhUoF1X7Gjqbw1XnVmMDpXM64jTmERvUfD: the real P2SH payout address of a real mainnet block (height 766469, coinbase txid
// c28d1fa55bce56d4de3822aa9039c0166d0a706b1d78b37ba51ed4223549fdb5, pays exactly 6.25 FNNC, single output -- also confirms reward.js and the "no devfee" coinbase shape)
check('real address from the network', u.validateMinerAddress('FhUoF1X7Gjqbw1XnVmMDpXM64jTmERvUfD') && u.addressScript('FhUoF1X7Gjqbw1XnVmMDpXM64jTmERvUfD') === 'a914870cffcde0d42d64d90a4132ba1a97e738c06bdc87');
check('valid address', u.validateMinerAddress(OK));
check('canonical form is the address itself', u.canonicalMinerAddress(OK) === OK);
check('script of a P2PKH address', u.addressScript(OK) === '76a914' + h160.toString('hex') + '88ac');
const p2sh = makeAddress(36, h160);
check('a P2SH address (also F...) is accepted, script OP_HASH160 <20> OP_EQUAL', p2sh[0] === 'F' && u.validateMinerAddress(p2sh) && u.addressScript(p2sh) === 'a914' + h160.toString('hex') + '87');
const flipped = OK.slice(0, -1) + (OK.slice(-1) === 'q' ? 'p' : 'q');
check('bad checksum rejected', !u.validateMinerAddress(flipped));
check('other network version rejected (Bitcoin 1..., Dash X...)', !u.validateMinerAddress(makeAddress(0, h160)) && !u.validateMinerAddress(makeAddress(76, h160)));
check('characters outside base58 rejected', !u.validateMinerAddress(OK.slice(0, -1) + '0') && !u.validateMinerAddress(OK.slice(0, -1) + 'l'));
check('too short rejected', !u.validateMinerAddress(OK.slice(0, 30)));
check('too long rejected', !u.validateMinerAddress(OK + 'q'));
check('empty and non-string rejected', !u.validateMinerAddress('') && !u.validateMinerAddress(null) && !u.validateMinerAddress(42));
check('account = address, no note', u.parseMinerAccount(OK).account === OK && u.parseMinerAccount(OK).note === null);
check('split back', u.splitMinerAccount(OK).address === OK && u.splitMinerAccount(OK).note === null);
check('reward mode prefix', u.determineRewardData('solo:' + OK).rewardType === 'solo' && u.determineRewardData('solo:' + OK).address === OK);

const dev = u.donationTable({donations: {[OK]: 0.5, 'nonsense': 1, [makeAddress(76, Buffer.alloc(20, 7))]: 50}});
check('donation table keeps valid entries only', Object.keys(dev).length === 1 && dev[OK] === 0.5);

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall checks passed');
process.exit(failed ? 1 : 0);
