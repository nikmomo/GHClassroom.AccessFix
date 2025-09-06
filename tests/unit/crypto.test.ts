import { verifyWebhookSignature, generateWebhookSignature } from '../../src/utils/crypto';

describe('Crypto Utils', () => {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ test: 'data' });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const signature = generateWebhookSignature(payload, secret);
      const result = verifyWebhookSignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const invalidSignature = 'sha256=invalid';
      const result = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it('should reject missing signature', () => {
      const result = verifyWebhookSignature(payload, undefined, secret);
      expect(result).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const signature = generateWebhookSignature(payload, 'wrong-secret');
      const result = verifyWebhookSignature(payload, signature, secret);
      expect(result).toBe(false);
    });

    it('should handle signatures without sha256= prefix', () => {
      const signature = generateWebhookSignature(payload, secret);
      const rawSignature = signature.replace('sha256=', '');
      const result = verifyWebhookSignature(payload, rawSignature, secret);
      expect(result).toBe(false);
    });
  });

  describe('generateWebhookSignature', () => {
    it('should generate consistent signatures', () => {
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, secret);
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload2 = JSON.stringify({ different: 'data' });
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload2, secret);
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, 'different-secret');
      expect(sig1).not.toBe(sig2);
    });

    it('should include sha256= prefix', () => {
      const signature = generateWebhookSignature(payload, secret);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});