// src/lib/firebaseCompat.ts
"use client";

import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/lib/firebase';

// Compatibility layer for Firebase Functions to avoid undici issues
class FirebaseFunctionCompat {
  private functions: any;
  private useCompat: boolean;

  constructor() {
    this.useCompat = this.shouldUseCompat();
    if (!this.useCompat) {
      this.functions = getFunctions(app);
    }
  }

  private shouldUseCompat(): boolean {
    // Check for undici/node compatibility issues
    if (typeof window === 'undefined') return true;
    
    // Check for specific error patterns that indicate undici conflicts
    const userAgent = navigator.userAgent;
    const isNode = userAgent.includes('Node.js') || typeof process !== 'undefined';
    
    return isNode;
  }

  async callFunction<T = any>(functionName: string, data?: any): Promise<T> {
    if (this.useCompat) {
      // Use compatibility mode - direct HTTP calls
      return this.callFunctionHTTP<T>(functionName, data);
    } else {
      // Use Firebase SDK
      return this.callFunctionSDK<T>(functionName, data);
    }
  }

  private async callFunctionSDK<T>(functionName: string, data?: any): Promise<T> {
    try {
      const callable = httpsCallable(this.functions, functionName);
      const result = await callable(data);
      return result.data as T;
    } catch (error: any) {
      console.error(`[FirebaseCompat] SDK Error calling ${functionName}:`, error);
      
      // If SDK fails, fallback to HTTP
      if (error.message?.includes('undici') || error.code === 'internal') {
        console.log(`[FirebaseCompat] Falling back to HTTP for ${functionName}`);
        return this.callFunctionHTTP<T>(functionName, data);
      }
      
      throw error;
    }
  }

  private async callFunctionHTTP<T>(functionName: string, data?: any): Promise<T> {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const region = 'us-central1'; // Default region
    
    if (!projectId) {
      throw new Error('Firebase project ID not configured');
    }

    const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify({ data: data || {} })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.result as T;
    } catch (error: any) {
      console.error(`[FirebaseCompat] HTTP Error calling ${functionName}:`, error);
      throw error;
    }
  }

  private async getAuthToken(): Promise<string> {
    // Get Firebase Auth token if user is authenticated
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch (error) {
      console.warn('[FirebaseCompat] Could not get auth token:', error);
    }
    return '';
  }

  // Helper method to update provider logo
  async updateProviderLogo(providerId: string, logoURL: string): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      
      const providerRef = doc(db, 'prestadores', providerId);
      await updateDoc(providerRef, { logoURL });
      
      console.log('[FirebaseCompat] Provider logo updated successfully');
    } catch (error) {
      console.error('[FirebaseCompat] Error updating provider logo:', error);
      throw error;
    }
  }
}

// Create singleton instance
const firebaseCompat = new FirebaseFunctionCompat();

export default firebaseCompat;
export { FirebaseFunctionCompat };