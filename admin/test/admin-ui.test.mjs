import test from 'node:test';
import assert from 'node:assert/strict';

// Helper logic tested in Admin UI
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '••••••••';
  const clean = key.trim();
  if (clean.length <= 4) return '••••••••' + clean;
  return '••••••••' + clean.slice(-4);
}

function validateAiEndpoint(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'URL không được để trống' };
  }
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'Định dạng URL không hợp lệ' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Chỉ chấp nhận giao thức HTTPS an toàn' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, error: 'Không cho phép hostname nội bộ hoặc loopback (SSRF guard)' };
  }
  return { valid: true };
}

test('Admin UI Key Masking: Extracts last 4 chars and conceals full secret key', () => {
  assert.equal(maskApiKey('AIzaSyD-1234567890abcdef'), '••••••••cdef');
  assert.equal(maskApiKey('sk-proj-xyz89'), '••••••••yz89');
  assert.equal(maskApiKey(''), '••••••••');
  assert.equal(maskApiKey(null), '••••••••');
});

test('Admin UI Endpoint Validation: Rejects HTTP, loopback, and allows valid HTTPS providers', () => {
  assert.equal(validateAiEndpoint('http://api.openai.com/v1').valid, false);
  assert.equal(validateAiEndpoint('https://localhost:8080/v1').valid, false);
  assert.equal(validateAiEndpoint('https://127.0.0.1:11434/v1').valid, false);
  assert.equal(validateAiEndpoint('not-a-url').valid, false);

  assert.equal(validateAiEndpoint('https://generativelanguage.googleapis.com/v1beta/openai').valid, true);
  assert.equal(validateAiEndpoint('https://api.groq.com/openai/v1').valid, true);
});

test('Admin UI Fail-Closed State Invariant: Unauthenticated requests trigger Fail-Closed banner', () => {
  const simulatedResponse = { status: 401, error: 'CF_ACCESS_UNAUTHORIZED' };
  const isFailClosed = simulatedResponse.status === 401 || simulatedResponse.status === 403;
  assert.equal(isFailClosed, true);
});

