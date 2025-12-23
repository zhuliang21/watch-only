// gate.js - Verify zpub against whitelist (server-first, with optional local fallback)

const ALLOWED_HASHES = [
  'c1a83cf49647ebf2b597ea543ba77a6c096a886f244df85b5bab1bffcf2b4449'
];

function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyZpub(zpub) {
  if (!zpub || typeof zpub !== 'string') {
    return { ok: false, reason: 'invalid_input' };
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(zpub.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = buf2hex(hashBuffer);

  const config = (typeof window !== 'undefined' && window.GATE_CONFIG) ? window.GATE_CONFIG : {};
  const metaUrl = (typeof document !== 'undefined' && document.querySelector)
    ? document.querySelector('meta[name="gate-verify-url"]')?.content
    : '';
  const verifyUrl = config.verifyUrl || metaUrl || '';
  const requireServer = config.requireServer !== false;
  const allowLocalFallback = config.allowLocalFallback === true;

  if (verifyUrl) {
    try {
      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hashHex })
      });
      if (!res.ok) return { ok: false, reason: 'server_reject' };
      const payload = await res.json();
      if (payload && payload.ok === true) return { ok: true };
      return { ok: false, reason: 'server_reject' };
    } catch (e) {
      if (requireServer) return { ok: false, reason: 'server_unreachable' };
    }
  }

  if (requireServer && !allowLocalFallback) {
    return { ok: false, reason: 'server_required' };
  }

  const ok = ALLOWED_HASHES.includes(hashHex);
  return ok ? { ok: true } : { ok: false, reason: 'local_reject' };
}

// Export for ESM import (tree-shaken usage), and attach to window for direct script usage
if (typeof window !== 'undefined') {
  window.verifyZpub = verifyZpub;
}

export { verifyZpub }; 
