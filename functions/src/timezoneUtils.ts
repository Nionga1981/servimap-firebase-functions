import * as admin from 'firebase-admin';

/**
 * Utilidades para manejo de zonas horarias en ServiMap
 * Garantiza conversión consistente entre zonas horarias de usuarios y prestadores
 */

export interface TimezoneConversion {
  originalTimestamp: admin.firestore.Timestamp;
  convertedTimestamp: admin.firestore.Timestamp;
  originalTimezone: string;
  targetTimezone: string;
  formattedTime: string;
}

export interface UserTimezonePreferences {
  timezone: string;
  locale: string;
  use24HourFormat: boolean;
  autoDetectTimezone: boolean;
}

export class TimezoneManager {
  
  /**
   * Convierte un timestamp de una zona horaria a otra
   */
  static convertTimezone(
    timestamp: admin.firestore.Timestamp,
    fromTimezone: string,
    toTimezone: string
  ): TimezoneConversion {
    const originalDate = new Date(timestamp.seconds * 1000);
    
    // Crear fecha en zona horaria origen
    const sourceDate = new Date(originalDate.toLocaleString("en-US", { timeZone: fromTimezone }));
    
    // Calcular diferencia entre zona origen y UTC
    const sourceOffset = originalDate.getTime() - sourceDate.getTime();
    
    // Aplicar conversión a zona destino
    const targetDate = new Date(originalDate.getTime() + sourceOffset);
    const convertedDate = new Date(targetDate.toLocaleString("en-US", { timeZone: toTimezone }));
    
    const finalDate = new Date(targetDate.getTime() + (targetDate.getTime() - convertedDate.getTime()));
    
    return {
      originalTimestamp: timestamp,
      convertedTimestamp: admin.firestore.Timestamp.fromDate(finalDate),
      originalTimezone: fromTimezone,
      targetTimezone: toTimezone,
      formattedTime: finalDate.toLocaleString('es-MX', {
        timeZone: toTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }

  /**
   * Convierte hora local a UTC para almacenamiento consistente
   */
  static convertToUTC(localTime: Date, timezone: string): admin.firestore.Timestamp {
    const utcTime = new Date(localTime.toLocaleString("en-US", { timeZone: "UTC" }));
    const localOffset = localTime.getTime() - new Date(localTime.toLocaleString("en-US", { timeZone: timezone })).getTime();
    const adjustedTime = new Date(utcTime.getTime() + localOffset);
    
    return admin.firestore.Timestamp.fromDate(adjustedTime);
  }

  /**
   * Convierte UTC a zona horaria del usuario
   */
  static convertFromUTC(utcTimestamp: admin.firestore.Timestamp, userTimezone: string): Date {
    const utcDate = new Date(utcTimestamp.seconds * 1000);
    return new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
  }

  /**
   * Obtiene la diferencia en horas entre dos zonas horarias
   */
  static getTimezoneOffset(timezone1: string, timezone2: string): number {
    const now = new Date();
    const time1 = new Date(now.toLocaleString("en-US", { timeZone: timezone1 }));
    const time2 = new Date(now.toLocaleString("en-US", { timeZone: timezone2 }));
    
    return (time2.getTime() - time1.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Detecta la zona horaria basada en coordenadas geográficas
   */
  static async detectTimezoneFromLocation(lat: number, lng: number): Promise<string> {
    // En un entorno real, usarías una API como Google Maps Timezone API
    // Por ahora, mapeo simple para México
    const mexicoTimezones = [
      { bounds: { north: 32.72, south: 14.39, east: -86.71, west: -118.40 }, timezone: 'America/Mexico_City' },
      { bounds: { north: 32.72, south: 25.84, east: -109.03, west: -118.40 }, timezone: 'America/Tijuana' },
      { bounds: { north: 29.07, south: 22.48, east: -104.05, west: -115.04 }, timezone: 'America/Chihuahua' },
      { bounds: { north: 27.99, south: 21.61, east: -102.03, west: -109.47 }, timezone: 'America/Mazatlan' }
    ];

    for (const zone of mexicoTimezones) {
      if (lat >= zone.bounds.south && lat <= zone.bounds.north &&
          lng >= zone.bounds.west && lng <= zone.bounds.east) {
        return zone.timezone;
      }
    }

    // Zona horaria por defecto para México
    return 'America/Mexico_City';
  }

  /**
   * Formatea tiempo según preferencias del usuario
   */
  static formatTimeForUser(
    timestamp: admin.firestore.Timestamp,
    userPrefs: UserTimezonePreferences
  ): string {
    const date = this.convertFromUTC(timestamp, userPrefs.timezone);
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: userPrefs.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: !userPrefs.use24HourFormat
    };

    return new Intl.DateTimeFormat(userPrefs.locale, options).format(date);
  }

  /**
   * Calcula horarios de disponibilidad considerando zona horaria del prestador
   */
  static calculateAvailabilityWindows(
    providerSchedule: any,
    providerTimezone: string,
    userTimezone: string,
    date: Date
  ): Array<{ start: Date; end: Date; isEmergency: boolean }> {
    const windows: Array<{ start: Date; end: Date; isEmergency: boolean }> = [];
    
    // Obtener día de la semana en zona del prestador
    const providerDate = new Date(date.toLocaleString("en-US", { timeZone: providerTimezone }));
    const dayOfWeek = providerDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: providerTimezone }).toLowerCase();
    
    const daySchedule = providerSchedule.workingHours[dayOfWeek];
    
    if (!daySchedule || !daySchedule.isAvailable) {
      return windows;
    }

    // Convertir horarios del prestador a zona del usuario
    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);
    
    const startTime = new Date(providerDate);
    startTime.setHours(startHour, startMin, 0, 0);
    
    const endTime = new Date(providerDate);
    endTime.setHours(endHour, endMin, 0, 0);
    
    // Convertir a zona horaria del usuario
    const userStartTime = new Date(startTime.toLocaleString("en-US", { timeZone: userTimezone }));
    const userEndTime = new Date(endTime.toLocaleString("en-US", { timeZone: userTimezone }));
    
    windows.push({
      start: userStartTime,
      end: userEndTime,
      isEmergency: false
    });

    // Agregar ventana de emergencia si está habilitada
    if (providerSchedule.emergencyAvailable) {
      // Horario nocturno: 22:00 - 06:00
      const emergencyStart = new Date(providerDate);
      emergencyStart.setHours(22, 0, 0, 0);
      
      const emergencyEnd = new Date(providerDate);
      emergencyEnd.setDate(emergencyEnd.getDate() + 1);
      emergencyEnd.setHours(6, 0, 0, 0);
      
      const userEmergencyStart = new Date(emergencyStart.toLocaleString("en-US", { timeZone: userTimezone }));
      const userEmergencyEnd = new Date(emergencyEnd.toLocaleString("en-US", { timeZone: userTimezone }));
      
      windows.push({
        start: userEmergencyStart,
        end: userEmergencyEnd,
        isEmergency: true
      });
    }

    return windows;
  }

  /**
   * Verifica si un horario está en horas de emergencia
   */
  static isEmergencyHours(timestamp: admin.firestore.Timestamp, timezone: string): boolean {
    const date = this.convertFromUTC(timestamp, timezone);
    const hour = date.getHours();
    
    // Horario de emergencia: 22:00 - 06:00
    return hour >= 22 || hour < 6;
  }

  /**
   * Calcula el siguiente slot disponible considerando buffer time
   */
  static calculateNextAvailableSlot(
    currentSlots: admin.firestore.Timestamp[],
    duration: number,
    bufferTime: number,
    timezone: string
  ): admin.firestore.Timestamp {
    const now = new Date();
    let nextSlot = new Date(now.getTime() + (30 * 60 * 1000)); // Empezar en 30 minutos
    
    // Convertir slots existentes a fechas locales
    const occupiedSlots = currentSlots.map(slot => 
      this.convertFromUTC(slot, timezone)
    ).sort((a, b) => a.getTime() - b.getTime());

    // Buscar el primer slot disponible
    for (const occupiedSlot of occupiedSlots) {
      const slotEnd = new Date(occupiedSlot.getTime() + (duration + bufferTime) * 60 * 1000);
      
      if (nextSlot >= occupiedSlot && nextSlot < slotEnd) {
        nextSlot = new Date(slotEnd.getTime() + bufferTime * 60 * 1000);
      }
    }

    return this.convertToUTC(nextSlot, timezone);
  }

  /**
   * Valida que un slot propuesto no tenga conflictos
   */
  static validateSlotAvailability(
    proposedSlot: admin.firestore.Timestamp,
    duration: number,
    existingSlots: admin.firestore.Timestamp[],
    bufferTime: number,
    timezone: string
  ): { isAvailable: boolean; conflicts: string[] } {
    const conflicts = [];
    const proposedStart = this.convertFromUTC(proposedSlot, timezone);
    const proposedEnd = new Date(proposedStart.getTime() + duration * 60 * 1000);

    for (const existingSlot of existingSlots) {
      const existingStart = this.convertFromUTC(existingSlot, timezone);
      const existingEnd = new Date(existingStart.getTime() + (duration + bufferTime) * 60 * 1000);

      // Verificar solapamiento
      if (proposedStart < existingEnd && proposedEnd > existingStart) {
        conflicts.push(`Conflicto con slot existente: ${existingStart.toLocaleString('es-MX', { 
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit' 
        })}`);
      }
    }

    return {
      isAvailable: conflicts.length === 0,
      conflicts
    };
  }

  /**
   * Genera slots de tiempo para un rango de fechas
   */
  static generateTimeSlots(
    startDate: Date,
    endDate: Date,
    duration: number,
    workingHours: { start: string; end: string },
    timezone: string
  ): admin.firestore.Timestamp[] {
    const slots = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);

      const dayStart = new Date(current);
      dayStart.setHours(startHour, startMin, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(endHour, endMin, 0, 0);

      // Generar slots cada 30 minutos
      const slotTime = new Date(dayStart);
      while (slotTime < dayEnd) {
        if (slotTime >= new Date()) { // Solo slots futuros
          slots.push(this.convertToUTC(slotTime, timezone));
        }
        slotTime.setTime(slotTime.getTime() + 30 * 60 * 1000);
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }
}

// Configuraciones de zona horaria comunes para México
export const MEXICO_TIMEZONES = {
  'America/Mexico_City': {
    name: 'Tiempo del Centro',
    states: ['CDMX', 'Estado de México', 'Puebla', 'Veracruz', 'Morelos', 'Hidalgo', 'Tlaxcala', 'Guerrero', 'Oaxaca', 'Chiapas', 'Tabasco', 'Campeche', 'Yucatán', 'Quintana Roo']
  },
  'America/Tijuana': {
    name: 'Tiempo del Pacífico',
    states: ['Baja California']
  },
  'America/Chihuahua': {
    name: 'Tiempo de la Montaña',
    states: ['Chihuahua', 'Durango', 'Coahuila', 'Nuevo León', 'Tamaulipas']
  },
  'America/Mazatlan': {
    name: 'Tiempo del Pacífico (Montaña)',
    states: ['Sinaloa', 'Sonora', 'Nayarit', 'Baja California Sur']
  }
};

// Utilidades para formateo de fecha/hora específicas de México
export const formatMexicanDateTime = (
  timestamp: admin.firestore.Timestamp,
  timezone: string = 'America/Mexico_City',
  includeSeconds: boolean = false
): string => {
  const date = TimezoneManager.convertFromUTC(timestamp, timezone);
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };

  if (includeSeconds) {
    options.second = '2-digit';
  }

  return new Intl.DateTimeFormat('es-MX', options).format(date);
};