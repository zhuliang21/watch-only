// gate.js - Verify zpub against precomputed SHA-256 hashes (client-side gate)

const ALLOWED_HASHES = [
  'c1a83cf49647ebf2b597ea543ba77a6c096a886f244df85b5bab1bffcf2b4449'
];

function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyZpub(zpub) {
  if (!zpub || typeof zpub !== 'string') return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(zpub.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = buf2hex(hashBuffer);
  return ALLOWED_HASHES.includes(hashHex);
}

// Export for ESM import (tree-shaken usage), and attach to window for direct script usage
if (typeof window !== 'undefined') {
  window.verifyZpub = verifyZpub;
}

export { verifyZpub }; 