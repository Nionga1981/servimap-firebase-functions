"use client";

import { 
  messaging,
  auth,
  db,
  requestNotificationPermission,
  onForegroundMessage,
  saveTokenToServer,
  removeFCMToken
} from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

export interface NotificationPreferences {
  serviceRequests: boolean;
  messages: boolean;
  payments: boolean;
  emergencies: boolean;
  community: boolean;
  marketing: boolean;
}

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: any[];
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface CustomNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

class NotificationService {
  private token: string | null = null;
  private preferences: NotificationPreferences = {
    serviceRequests: true,
    messages: true,
    payments: true,
    emergencies: true,
    community: true,
    marketing: false,
  };

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    if (typeof window === 'undefined') return;

    // Load saved preferences
    this.loadPreferences();

    // Setup foreground message handler
    onForegroundMessage(this.handleForegroundMessage.bind(this));

    // Setup service worker message handler
    this.setupServiceWorkerMessageHandler();
  }

  /**
   * Request notification permission and get FCM token
   */
  async requestPermission(): Promise<string | null> {
    try {
      this.token = await requestNotificationPermission();
      
      if (this.token) {
        await this.savePreferencesToServer();
        localStorage.setItem('fcm_token', this.token);
      }
      
      return this.token;
    } catch (error) {
      console.error('[NotificationService] Error requesting permission:', error);
      return null;
    }
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.token || localStorage.getItem('fcm_token');
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(newPreferences: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...newPreferences };
    localStorage.setItem('notification_preferences', JSON.stringify(this.preferences));
    
    // Save to server if user is authenticated
    await this.savePreferencesToServer();
  }

  /**
   * Get current notification preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Show a custom notification (for foreground messages)
   */
  showCustomNotification(data: NotificationData): void {
    // Check if this notification type is enabled
    const notificationType = data.data?.type;
    if (notificationType && !this.isNotificationTypeEnabled(notificationType)) {
      console.log(`[NotificationService] Notification type '${notificationType}' is disabled`);
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-72x72.png',
        tag: data.tag || 'servimap',
        data: data.data,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        // actions: data.actions?.map(action => ({
        //   action: action.action,
        //   title: action.title,
        //   icon: action.icon
        // })) || []
      });

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        this.handleNotificationClick(data);
        notification.close();
      };

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!data.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }
    } else {
      // Fallback to custom toast notification
      this.showToastNotification(data);
    }
  }

  /**
   * Handle foreground messages
   */
  private handleForegroundMessage(payload: any): void {
    console.log('[NotificationService] Foreground message received:', payload);

    const notificationData: NotificationData = {
      title: payload.notification?.title || 'Nueva notificación',
      body: payload.notification?.body || '',
      icon: payload.notification?.icon,
      data: payload.data || {},
      requireInteraction: payload.data?.priority === 'high',
    };

    // Add action buttons based on notification type
    if (payload.data?.type === 'service_request') {
      notificationData.actions = [
        { action: 'view', title: 'Ver solicitud', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Descartar', icon: '/icons/dismiss.png' }
      ];
    } else if (payload.data?.type === 'message') {
      notificationData.actions = [
        { action: 'reply', title: 'Responder', icon: '/icons/reply.png' },
        { action: 'view_chat', title: 'Ver chat', icon: '/icons/chat.png' }
      ];
    }

    this.showCustomNotification(notificationData);
  }

  /**
   * Setup service worker message handler for background messages
   */
  private setupServiceWorkerMessageHandler(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICKED') {
          this.handleNotificationClick(event.data.notification);
        }
      });
    }
  }

  /**
   * Handle notification click events
   */
  private handleNotificationClick(notificationData: NotificationData): void {
    const { data } = notificationData;
    
    // Focus or open the app window
    if (typeof window !== 'undefined') {
      window.focus();
    }

    // Route based on notification type
    if (data?.type === 'service_request' && data?.requestId) {
      window.location.href = `/service-request/${data.requestId}`;
    } else if (data?.type === 'message' && data?.chatId) {
      window.location.href = `/chat/${data.chatId}`;
    } else if (data?.type === 'payment' && data?.paymentId) {
      window.location.href = `/payment/${data.paymentId}`;
    } else if (data?.type === 'emergency' && data?.emergencyId) {
      window.location.href = `/emergency/${data.emergencyId}`;
    } else if (data?.type === 'community' && data?.communityId) {
      window.location.href = `/community/${data.communityId}`;
    } else if (data?.url) {
      window.location.href = data.url;
    } else {
      window.location.href = '/dashboard';
    }
  }

  /**
   * Show toast notification as fallback
   */
  private showToastNotification(data: NotificationData): void {
    const toast = document.createElement('div');
    toast.className = `
      fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm z-[9999] 
      transform translate-x-full transition-transform duration-300 cursor-pointer
      hover:shadow-2xl hover:scale-105
    `;
    
    toast.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L3 7v11h14V7l-7-5z"/>
            </svg>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900">${data.title}</p>
          <p class="text-sm text-gray-600 mt-1">${data.body}</p>
          ${data.data?.actions ? '<div class="mt-2 space-x-2">' + 
            data.data.actions.map((action: any) => 
              `<button class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" 
                      onclick="handleToastAction('${action.action}')">${action.title}</button>`
            ).join('') + '</div>' : ''}
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);
    
    // Handle click to navigate
    toast.onclick = (event) => {
      if (!(event.target as Element).closest('button')) {
        this.handleNotificationClick(data);
        toast.remove();
      }
    };
    
    // Auto remove after 6 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationTypeEnabled(type: string): boolean {
    switch (type) {
      case 'service_request':
        return this.preferences.serviceRequests;
      case 'message':
        return this.preferences.messages;
      case 'payment':
        return this.preferences.payments;
      case 'emergency':
        return this.preferences.emergencies;
      case 'community':
        return this.preferences.community;
      case 'marketing':
        return this.preferences.marketing;
      default:
        return true;
    }
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    const saved = localStorage.getItem('notification_preferences');
    if (saved) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      } catch (error) {
        console.warn('[NotificationService] Error loading preferences:', error);
      }
    }
  }

  /**
   * Save preferences to server
   */
  private async savePreferencesToServer(): Promise<void> {
    if (!auth.currentUser || !this.token) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        notificationPreferences: this.preferences,
        fcmTokens: arrayUnion(this.token),
        lastTokenUpdate: new Date()
      });
    } catch (error) {
      console.error('[NotificationService] Error saving preferences to server:', error);
    }
  }

  /**
   * Remove FCM token (on logout)
   */
  async removeToken(): Promise<void> {
    if (auth.currentUser) {
      await removeFCMToken(auth.currentUser.uid);
    }
    
    this.token = null;
    localStorage.removeItem('fcm_token');
    localStorage.removeItem('notification_preferences');
  }

  /**
   * Test notification (for debugging)
   */
  testNotification(): void {
    this.showCustomNotification({
      title: 'Notificación de Prueba',
      body: 'Esta es una notificación de prueba de ServiMap',
      data: { type: 'test' },
      actions: [
        { action: 'ok', title: 'Entendido' }
      ]
    });
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Make handleToastAction available globally for inline handlers
(window as any).handleToastAction = (action: string) => {
  console.log('[NotificationService] Toast action clicked:', action);
  // Handle different actions
  if (action === 'ok') {
    // Close any open toasts
    document.querySelectorAll('[class*="translate-x-full"]').forEach(toast => toast.remove());
  }
};

export default notificationService;
export { NotificationService };