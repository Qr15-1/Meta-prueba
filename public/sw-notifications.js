/**
 * 🔔 Service Worker para Notificaciones con Pestaña Cerrada
 * Este service worker maneja las notificaciones push
 */

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activado');
  event.waitUntil(clients.claim());
});

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('📬 Service Worker recibió mensaje:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const alert = event.data.alert;
    showPushNotification(alert);
  }
});

// ⭐ NUEVO: Escuchar Push Events (funciona con app cerrada)
self.addEventListener('push', (event) => {
  console.log('📨 Push event recibido:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📦 Datos del push:', data);
      
      event.waitUntil(
        showPushNotification(data)
      );
    } catch (error) {
      console.error('❌ Error al procesar push:', error);
    }
  }
});

/**
 * Muestra una notificación push (funciona con pestaña cerrada)
 */
function showPushNotification(alert) {
  const changeSymbol = alert.cambio > 0 ? '+' : '';
  const severity = alert.gravedad === 'alta' ? '[URGENTE]' : '[ALERTA]';
  
  // Obtener hora actual
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  
  const title = `${severity} ${alert.accountName} - Meta IA`;
  const campaignInfo = alert.campaignName ? `${alert.campaignName}\n` : '';
  const bodyText = `${campaignInfo}${alert.metricaLabel}\n${changeSymbol}${alert.cambio.toFixed(1)}%  |  $${alert.valorBase.toFixed(2)} → $${alert.valorActual.toFixed(2)}\n${timeStr}`;
  
  const options = {
    body: bodyText,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: alert.id,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      alertId: alert.id,
      url: '/dashboard'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir Dashboard'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  self.registration.showNotification(title, options);
  console.log('🔔 Notificación push enviada');
}

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Click en notificación:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    // Abrir o enfocar el dashboard
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Buscar si ya hay una pestaña abierta
          for (let client of clientList) {
            if (client.url.includes('/dashboard') && 'focus' in client) {
              return client.focus();
            }
          }
          // Si no hay pestaña abierta, abrir una nueva
          if (clients.openWindow) {
            return clients.openWindow('/dashboard');
          }
        })
    );
  }
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notificación cerrada:', event.notification.tag);
});

console.log('🚀 Service Worker de notificaciones iniciado');


