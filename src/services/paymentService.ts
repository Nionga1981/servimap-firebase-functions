// src/services/paymentService.ts
"use client";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

export interface CreatePaymentIntentData {
  amount: number;
  currency?: string;
  serviceId: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface ConfirmPaymentData {
  paymentIntentId: string;
  serviceRequestId: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  paymentStatus: string;
}

export interface RefundPaymentData {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResponse {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

/**
 * Creates a payment intent for processing a payment
 */
export const createPaymentIntent = async (
  data: CreatePaymentIntentData
): Promise<CreatePaymentIntentResponse> => {
  console.log('[PaymentService] Creating payment intent...', data);
  
  const functions = getFunctions(app);
  const createPaymentIntentFn = httpsCallable(functions, 'createPaymentIntent');
  
  try {
    const result = await createPaymentIntentFn(data);
    console.log('[PaymentService] Payment intent created:', result.data);
    return result.data as CreatePaymentIntentResponse;
  } catch (error) {
    console.error('[PaymentService] Error creating payment intent:', error);
    throw new Error('Failed to create payment intent');
  }
};

/**
 * Confirms a payment and updates the service request status
 */
export const confirmPayment = async (
  data: ConfirmPaymentData
): Promise<ConfirmPaymentResponse> => {
  console.log('[PaymentService] Confirming payment...', data);
  
  const functions = getFunctions(app);
  const confirmPaymentFn = httpsCallable(functions, 'confirmPayment');
  
  try {
    const result = await confirmPaymentFn(data);
    console.log('[PaymentService] Payment confirmed:', result.data);
    return result.data as ConfirmPaymentResponse;
  } catch (error) {
    console.error('[PaymentService] Error confirming payment:', error);
    throw new Error('Failed to confirm payment');
  }
};

/**
 * Processes a refund for a payment
 */
export const refundPayment = async (
  data: RefundPaymentData
): Promise<RefundPaymentResponse> => {
  console.log('[PaymentService] Processing refund...', data);
  
  const functions = getFunctions(app);
  const refundPaymentFn = httpsCallable(functions, 'refundPayment');
  
  try {
    const result = await refundPaymentFn(data);
    console.log('[PaymentService] Refund processed:', result.data);
    return result.data as RefundPaymentResponse;
  } catch (error) {
    console.error('[PaymentService] Error processing refund:', error);
    throw new Error('Failed to process refund');
  }
};

/**
 * Mock function to simulate payment status checking
 * In a real app, you might want to fetch this from Firestore or Stripe directly
 */
export const getPaymentStatus = async (paymentIntentId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}> => {
  console.log('[PaymentService] Fetching payment status for:', paymentIntentId);
  
  // This is a mock implementation
  // In a real app, you would fetch from your backend or Stripe
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    status: 'succeeded',
    amount: 100,
    currency: 'mxn',
    metadata: {
      serviceId: 'service_123',
      serviceName: 'Mock Service'
    }
  };
};

export default {
  createPaymentIntent,
  confirmPayment,
  refundPayment,
  getPaymentStatus,
};