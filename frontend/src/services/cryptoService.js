// Base64 helper functions
export function arrayToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArray(b64) {
  const binary_string = atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Generate Ed25519 keypair
export async function generateKeypair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );
  
  const pubKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  
  return {
    pubKey: arrayToBase64(pubKeyRaw),
    privKeyRaw
  };
}

// Derive AES-GCM key from PIN using PBKDF2
export async function deriveKeyFromPIN(pin, salt) {
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await crypto.subtle.importKey(
    'raw', 
    pinBytes, 
    { name: 'PBKDF2' }, 
    false, 
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt private key using AES-GCM encryption
export async function encryptPrivateKey(privKeyRaw, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privKeyRaw
  );
  
  return {
    encryptedKey: arrayToBase64(encrypted),
    iv: arrayToBase64(iv)
  };
}

// Decrypt private key returning decrypted CryptoKey
export async function decryptPrivateKey(encryptedKeyB64, ivB64, aesKey) {
  const encrypted = base64ToArray(encryptedKeyB64);
  const iv = base64ToArray(ivB64);
  
  const privKeyRaw = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encrypted
  );
  
  return await window.crypto.subtle.importKey(
    'pkcs8', 
    privKeyRaw,
    { name: 'Ed25519' },
    false,
    ['sign']
  );
}

// Sign transaction using Ed25519 signing
export async function signTransaction(payload, privateKey) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await window.crypto.subtle.sign('Ed25519', privateKey, data);
  return arrayToBase64(sig);
}

// Verify transaction using Ed25519 verification
export async function verifySignature(payload, signatureB64, pubKeyB64) {
  const pubKeyRaw = base64ToArray(pubKeyB64);
  const pubKey = await window.crypto.subtle.importKey(
    'raw', 
    pubKeyRaw,
    { name: 'Ed25519' },
    false,
    ['verify']
  );
  
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sig = base64ToArray(signatureB64);
  
  return await window.crypto.subtle.verify('Ed25519', pubKey, sig, data);
}
