// src/services/adminService.ts
"use client";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { ReporteServicio } from '@/types';

/**
 * Fetches a list of reports that are pending review.
 * This should only be accessible from an admin panel.
 * @returns A promise that resolves to an array of pending reports.
 */
export const getPendingReports = async (): Promise<ReporteServicio[]> => {
  console.log("[AdminService] Fetching pending reports...");
  const functions = getFunctions(app);
  const getPendingReportsFunction = httpsCallable(functions, 'getPendingReports');

  try {
    const result = await getPendingReportsFunction();
    return result.data as ReporteServicio[];
  } catch (error) {
    console.error("[AdminService] Error calling 'getPendingReports':", error);
    throw error;
  }
};

interface ResolveReportPayload {
  reporteId: string;
  decision: 'resuelto_compensacion' | 'resuelto_sin_compensacion' | 'rechazado_reporte';
  comentarioAdmin: string;
}

/**
 * Resolves a specific report.
 * This should only be accessible from an admin panel.
 * @param payload - The data required to resolve the report.
 * @returns A promise that resolves to the result of the function call.
 */
export const resolveReport = async (payload: ResolveReportPayload): Promise<any> => {
  console.log(`[AdminService] Resolving report ${payload.reporteId} with decision: ${payload.decision}`);
  const functions = getFunctions(app);
  const resolveReportFunction = httpsCallable(functions, 'resolveReport');

  try {
    const result = await resolveReportFunction(payload);
    console.log('[AdminService] Report resolved successfully:', result.data);
    return result.data;
  } catch (error) {
    console.error(`[AdminService] Error calling 'resolveReport' for report ${payload.reporteId}:`, error);
    throw error;
  }
};
