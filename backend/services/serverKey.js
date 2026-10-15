// The server's own Ed25519 key. It signs offline allowance vouchers; phones verify them offline
// with SERVER_PUB. Generated on first start and kept in backend/keys/ (git-ignored — back it up:
// a new key would make every voucher already issued unverifiable).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = process.env.SERVER_KEY_PATH
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'keys', 'server-ed25519.pem');

let privateKey;
if (fs.existsSync(file)) {
  privateKey = crypto.createPrivateKey(fs.readFileSync(file));
} else {
  privateKey = crypto.generateKeyPairSync('ed25519').privateKey;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  console.log('🔑 Generated server signing key at', file);
}

// raw 32-byte public key, base64 (same format as user keys)
export const SERVER_PUB = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');

export const serverSign = (text) => crypto.sign(null, Buffer.from(text), privateKey).toString('base64');
