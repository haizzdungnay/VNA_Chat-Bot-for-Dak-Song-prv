/**
 * Web Crypto AES-256-GCM Envelope Encryption
 * Safe storage for AI Provider API keys in D1.
 */

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getAesGcmKey(secret: string): Promise<CryptoKey> {
  if (!secret || typeof secret !== "string" || secret.trim().length < 16) {
    throw new Error("ADMIN_ENCRYPTION_KEY thiếu hoặc không đủ độ dài bảo mật (tối thiểu 16 ký tự).");
  }

  // Derive 256-bit key using SHA-256 digest
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret.trim());
  const keyHash = await crypto.subtle.digest("SHA-256", secretBytes);

  return await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedEnvelope {
  v: number;
  iv: string;
  data: string;
}

/**
 * Encrypts an API key string using AES-256-GCM with a fresh random 96-bit (12-byte) IV.
 */
export async function encryptApiKey(plaintext: string, secret: string): Promise<string> {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Không thể mã hóa chuỗi rỗng.");
  }

  const key = await getAesGcmKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext.trim());

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );

  const envelope: EncryptedEnvelope = {
    v: 1,
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(ciphertext),
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypts an AES-256-GCM envelope back to the original plaintext key.
 * Throws if the envelope is tampered with, corrupted, or decrypted with the wrong master key.
 */
export async function decryptApiKey(envelopeString: string, secret: string): Promise<string> {
  if (!envelopeString || typeof envelopeString !== "string") {
    throw new Error("Dữ liệu khóa mã hóa không hợp lệ.");
  }

  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(envelopeString);
  } catch {
    throw new Error("Định dạng phong bì mã hóa không phải JSON hợp lệ.");
  }

  if (envelope.v !== 1 || !envelope.iv || !envelope.data) {
    throw new Error("Phiên bản phong bì mã hóa không tương thích.");
  }

  const key = await getAesGcmKey(secret);
  const iv = base64ToUint8Array(envelope.iv);
  const data = base64ToUint8Array(envelope.data);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error("Giải mã thất bại: Dữ liệu đã bị can thiệp (tampered) hoặc sai ADMIN_ENCRYPTION_KEY.");
  }
}

