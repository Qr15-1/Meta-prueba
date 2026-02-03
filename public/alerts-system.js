/**
 * Sistema de Alertas de Meta IA
 * Detecta cambios significativos en las métricas de costo
 */

// Configuración
const CONFIG = {
  THRESHOLD_PERCENT: 10, // Umbral de alerta (10%)
  CHECK_INTERVAL: 60 * 60 * 1000, // 1 hora en milisegundos
  HISTORY_RETENTION_DAYS: 30,
  METRICS_TO_MONITOR: [
    'costPerMessaging', // Costo por Mensaje Iniciado
    'cpc', // Costo por Clic
    'cpm', // CPM
    'cpp', // Costo por Alcance
    'costPerLinkClick' // Costo por Clic en Enlace
  ]
};

// Nombres legibles de las métricas
const METRIC_LABELS = {
  costPerMessaging: 'Costo por Mensaje Iniciado',
  cpc: 'Costo por Clic (CPC)',
  cpm: 'CPM',
  cpp: 'Costo por Alcance',
  costPerLinkClick: 'Costo por Clic en Enlace'
};

/**
 * Guarda las métricas actuales en el histórico
 */
function saveMetricsSnapshot(accountId, accountName, metrics) {
  const history = JSON.parse(localStorage.getItem('metrics_history') || '{}');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

  // Inicializar cuenta si no existe
  if (!history[accountId]) {
    history[accountId] = {
      nombre: accountName,
      base_del_dia: null,
      ultima_revision: null,
      historico_detallado: [],
      snapshots_diarios: []
    };
  }

  const account = history[accountId];

  // Si es el primer snapshot del día, establecer como base
  if (!account.base_del_dia || account.base_del_dia.fecha !== today) {
    account.base_del_dia = {
      fecha: today,
      hora: time,
      metricas: extractCostMetrics(metrics)
    };
    console.log(`Nueva base establecida para ${accountName}:`, account.base_del_dia);
  }

  // Guardar snapshot actual
  const snapshot = {
    timestamp: now.toISOString(),
    fecha: today,
    hora: time,
    metricas: extractCostMetrics(metrics)
  };

  account.ultima_revision = snapshot;
  account.historico_detallado.push(snapshot);

  // Limpiar histórico detallado (solo últimas 24 horas)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  account.historico_detallado = account.historico_detallado.filter(
    entry => new Date(entry.timestamp) > oneDayAgo
  );

  // Al cambiar de día, guardar snapshot diario
  const lastDailySnapshot = account.snapshots_diarios[account.snapshots_diarios.length - 1];
  if (!lastDailySnapshot || lastDailySnapshot.fecha !== today) {
    if (account.ultima_revision && account.ultima_revision.fecha !== today) {
      account.snapshots_diarios.push({
        fecha: account.ultima_revision.fecha,
        metricas: account.ultima_revision.metricas
      });
    }
  }

  // Limpiar snapshots antiguos (solo últimos 30 días)
  const retentionDate = new Date(now.getTime() - CONFIG.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  account.snapshots_diarios = account.snapshots_diarios.filter(
    entry => new Date(entry.fecha) > retentionDate
  );

  localStorage.setItem('metrics_history', JSON.stringify(history));
  console.log(`Snapshot guardado para ${accountName} a las ${time}`);
  
  return account;
}

/**
 * Extrae solo las métricas de costo relevantes
 */
function extractCostMetrics(metrics) {
  const result = {};
  
  for (const key of CONFIG.METRICS_TO_MONITOR) {
    if (metrics[key] && metrics[key].value !== undefined) {
      result[key] = metrics[key].value;
    }
  }
  
  return result;
}

/**
 * Compara las métricas actuales con la base del día
 * y genera alertas si hay cambios significativos
 */
function compareAndGenerateAlerts(accountId, accountName, currentMetrics, campaigns = []) {
  const history = JSON.parse(localStorage.getItem('metrics_history') || '{}');
  const account = history[accountId];

  if (!account || !account.base_del_dia) {
    console.log(`No hay base de comparación para ${accountName}`);
    return [];
  }

  const alerts = [];
  const currentCosts = extractCostMetrics(currentMetrics);
  const baseCosts = account.base_del_dia.metricas;
  const existingAlerts = getActiveAlerts();

  console.log(`Comparando métricas de ${accountName}:`, {
    base: baseCosts,
    actual: currentCosts
  });

  for (const metric of CONFIG.METRICS_TO_MONITOR) {
    const baseValue = baseCosts[metric];
    const currentValue = currentCosts[metric];

    // Validar que ambos valores existan y sean > 0
    if (!baseValue || !currentValue || baseValue === 0) continue;

    // Calcular cambio porcentual
    const changePercent = ((currentValue - baseValue) / baseValue) * 100;

    console.log(`  ${metric}: $${baseValue.toFixed(2)} → $${currentValue.toFixed(2)} (${changePercent.toFixed(1)}%)`);

    // Si supera el umbral, generar alerta
    if (Math.abs(changePercent) >= CONFIG.THRESHOLD_PERCENT) {
      // Verificar si ya existe una alerta reciente para esta métrica (últimas 4 horas)
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const existingAlert = existingAlerts.find(a => {
        if (a.accountId === accountId && a.metrica === metric) {
          const alertTime = new Date(a.timestamp);
          return alertTime > fourHoursAgo; // Alerta reciente (leída o no)
        }
        return false;
      });

      if (!existingAlert) {
        // Buscar la campaña con el mayor costo en esta métrica
        let campaignName = null;
        if (campaigns && campaigns.length > 0) {
          const sortedCampaigns = campaigns
            .filter(c => c[metric] && c[metric] > 0)
            .sort((a, b) => b[metric] - a[metric]);
          
          if (sortedCampaigns.length > 0) {
            campaignName = sortedCampaigns[0].name;
          }
        }

        const alert = {
          id: `${accountId}_${metric}_${Date.now()}`,
          accountId: accountId,
          accountName: accountName,
          metrica: metric,
          metricaLabel: METRIC_LABELS[metric],
          valorBase: baseValue,
          valorActual: currentValue,
          cambio: changePercent,
          campaignName: campaignName,
          timestamp: new Date().toISOString(),
          gravedad: Math.abs(changePercent) > 20 ? 'alta' : 'media',
          leida: false
        };

        alerts.push(alert);
        console.log(`ALERTA GENERADA: ${accountName} - ${METRIC_LABELS[metric]} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%${campaignName ? ` (${campaignName})` : ''}`);
      }
    }
  }

  // Guardar nuevas alertas
  if (alerts.length > 0) {
    saveAlerts(alerts);
  }

  return alerts;
}

/**
 * Guarda las alertas en LocalStorage
 */
function saveAlerts(newAlerts) {
  const alerts = JSON.parse(localStorage.getItem('active_alerts') || '[]');
  alerts.push(...newAlerts);
  localStorage.setItem('active_alerts', JSON.stringify(alerts));
  
  // Actualizar badge
  updateAlertsBadge();
}

/**
 * Obtiene las alertas activas
 */
function getActiveAlerts() {
  const alerts = JSON.parse(localStorage.getItem('active_alerts') || '[]');
  
  // Filtrar alertas de más de 7 días
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const filtered = alerts.filter(alert => new Date(alert.timestamp) > sevenDaysAgo);
  
  if (filtered.length !== alerts.length) {
    localStorage.setItem('active_alerts', JSON.stringify(filtered));
  }
  
  return filtered;
}

/**
 * Marca una alerta como leída
 */
function markAlertAsRead(alertId) {
  const alerts = getActiveAlerts();
  const alert = alerts.find(a => a.id === alertId);
  
  if (alert) {
    alert.leida = true;
    localStorage.setItem('active_alerts', JSON.stringify(alerts));
    updateAlertsBadge();
  }
}

/**
 * Obtiene el número de alertas no leídas
 */
function getUnreadAlertsCount() {
  const alerts = getActiveAlerts();
  return alerts.filter(a => !a.leida).length;
}

/**
 * Actualiza el badge de alertas en la UI
 */
function updateAlertsBadge() {
  const count = getUnreadAlertsCount();
  const badge = document.getElementById('alertsBadge');
  
  if (badge) {
    if (count > 0) {
      badge.textContent = count; // Mostrar número real sin límite
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Elimina todas las alertas
 */
function clearAllAlerts() {
  localStorage.removeItem('active_alerts');
  updateAlertsBadge();
  console.log('Todas las alertas han sido eliminadas');
  return true;
}

/**
 * Procesa una cuenta: guarda snapshot y genera alertas
 * @param {boolean} showNotifications - Si es true, muestra notificaciones del navegador
 */
async function processAccount(accountId, accountName, metrics, campaigns = [], showNotifications = false) {
  console.log(`\nProcesando cuenta: ${accountName} (${accountId})`);
  
  // Guardar snapshot
  saveMetricsSnapshot(accountId, accountName, metrics);
  
  // Comparar y generar alertas
  const alerts = compareAndGenerateAlerts(accountId, accountName, metrics, campaigns);
  
  // Si hay alertas nuevas Y showNotifications es true, mostrar notificación del navegador
  if (showNotifications && alerts.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
    for (const alert of alerts) {
      showBrowserNotification(alert);
    }
  }
  
  return alerts;
}

/**
 * Muestra una notificación del navegador - ESTILO MINIMALISTA
 */
function showBrowserNotification(alert) {
  const changeSymbol = alert.cambio > 0 ? '+' : '';
  const severity = alert.gravedad === 'alta' ? '[URGENTE]' : '[ALERTA]';
  
  // Obtener hora actual
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  
  // Reproducir sonido de alerta
  playAlertSound(alert.gravedad);
  
  // Preparar el cuerpo de la notificación con hora
  const campaignInfo = alert.campaignName ? `${alert.campaignName}\n` : '';
  const bodyText = `${campaignInfo}${alert.metricaLabel}\n${changeSymbol}${alert.cambio.toFixed(1)}%  |  $${alert.valorBase.toFixed(2)} → $${alert.valorActual.toFixed(2)}\n${timeStr}`;
  
  // Mostrar notificación del navegador
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${severity} ${alert.accountName} - Meta IA`, {
      body: bodyText,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: alert.id,
      requireInteraction: true,
      silent: false,
      data: { alertId: alert.id },
      vibrate: [200, 100, 200] // Vibración en móviles
    });
  }
  
  // También enviar a través del Service Worker (para pestaña cerrada)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      alert: alert
    });
  }
}

/**
 * Reproduce sonido de alerta
 */
function playAlertSound(gravedad) {
  try {
    // Crear contexto de audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Frecuencias diferentes según gravedad
    const frequency = gravedad === 'alta' ? 800 : 600;
    const duration = gravedad === 'alta' ? 0.3 : 0.2;
    
    // Crear oscilador
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configurar sonido
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Envelope (subir y bajar volumen suavemente)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
    
    // Reproducir
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    // Si es gravedad alta, reproducir dos tonos
    if (gravedad === 'alta') {
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.value = 950;
        oscillator2.type = 'sine';
        
        gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
        
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + duration);
      }, 150);
    }
    
    console.log('Sonido de alerta reproducido');
  } catch (error) {
    console.warn('No se pudo reproducir sonido:', error);
  }
}

/**
 * Solicita permisos de notificación
 */
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    console.log('Permiso de notificaciones:', permission);
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

// Exportar funciones para uso global
window.AlertsSystem = {
  saveMetricsSnapshot,
  compareAndGenerateAlerts,
  processAccount,
  getActiveAlerts,
  getUnreadAlertsCount,
  markAlertAsRead,
  updateAlertsBadge,
  clearAllAlerts,
  requestNotificationPermission,
  CONFIG
};

console.log('Sistema de alertas cargado');

