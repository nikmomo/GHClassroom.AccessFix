import { createHmac, timingSafeEqual } from 'crypto';
import { createChildLogger } from './logger';

const logger = createChildLogger('crypto');

export const verifyWebhookSignature = (
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean => {
  if (!signature) {
    logger.warn('No signature provided in webhook request');
    return false;
  }

  try {
    const sig = signature.replace('sha256=', '');
    const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
    
    const sigBuffer = Buffer.from(sig, 'hex');
    const expectedSigBuffer = Buffer.from(expectedSig, 'hex');
    
    if (sigBuffer.length !== expectedSigBuffer.length) {
      logger.warn('Signature length mismatch');
      return false;
    }
    
    const isValid = timingSafeEqual(sigBuffer, expectedSigBuffer);
    
    if (!isValid) {
      logger.warn('Invalid webhook signature');
    }
    
    return isValid;
  } catch (error) {
    logger.error({ error }, 'Error verifying webhook signature');
    return false;
  }
};

export const generateWebhookSignature = (payload: string, secret: string): string => {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
};