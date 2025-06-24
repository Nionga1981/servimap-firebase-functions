// src/services/adminService.ts
"use client";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { ReporteServicio, MonitoredService } from '@/types';

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

/**
 * Fetches a list of active services (pending or in progress).
 * This should only be accessible from an admin panel.
 * @returns A promise that resolves to an array of monitored services.
 */
export const getActiveServices = async (): Promise<MonitoredService[]> => {
    console.log("[AdminService] Fetching active services...");
    const functions = getFunctions(app);
    const getActiveServicesFunction = httpsCallable(functions, 'getActiveServices');

    try {
        const result = await getActiveServicesFunction();
        // The data is already in the correct format from the cloud function
        return result.data as MonitoredService[];
    } catch (error) {
        console.error("[AdminService] Error calling 'getActiveServices':", error);
        throw error;
    }
};

/**
 * Allows an admin to manually cancel a service.
 * @param serviceId The ID of the service to cancel.
 * @param reason The reason for the cancellation.
 * @returns A promise that resolves with the result of the operation.
 */
export const adminCancelService = async (serviceId: string, reason: string): Promise<any> => {
    console.log(`[AdminService] Admin cancelling service ${serviceId} for reason: ${reason}`);
    const functions = getFunctions(app);
    const adminCancelServiceFunction = httpsCallable(functions, 'adminCancelService');

    try {
        const result = await adminCancelServiceFunction({ serviceId, reason });
        console.log(`[AdminService] Service ${serviceId} cancelled by admin:`, result.data);
        return result.data;
    } catch (error) {
        console.error(`[AdminService] Error calling 'adminCancelService' for service ${serviceId}:`, error);
        throw error;
    }
};

/**
 * Allows an admin to force-complete a service and release payment.
 * @param serviceId The ID of the service to complete.
 * @param reason The reason for the manual completion.
 * @returns A promise that resolves with the result of the operation.
 */
export const adminForceCompleteService = async (serviceId: string, reason: string): Promise<any> => {
    console.log(`[AdminService] Admin force-completing service ${serviceId} for reason: ${reason}`);
    const functions = getFunctions(app);
    const adminForceCompleteServiceFunction = httpsCallable(functions, 'adminForceCompleteService');

    try {
        const result = await adminForceCompleteServiceFunction({ serviceId, reason });
        console.log(`[AdminService] Service ${serviceId} force-completed by admin:`, result.data);
        return result.data;
    } catch (error) {
        console.error(`[AdminService] Error calling 'adminForceCompleteService' for service ${serviceId}:`, error);
        throw error;
    }
};
