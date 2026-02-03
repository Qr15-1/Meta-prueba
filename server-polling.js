/**
 * 🤖 Sistema de Polling Automático para Push Notifications
 * Este script se ejecuta en el servidor y revisa las métricas cada 15 minutos
 */

import fetch from 'node-fetch';

const POLLING_INTERVAL = 15 * 60 * 1000; // 15 minutos
const API_URL = process.env.API_URL || 'http://localhost:4321';

console.log('🚀 Iniciando sistema de polling automático...');
console.log(`⏰ Intervalo: cada 15 minutos`);
console.log(`🌐 API URL: ${API_URL}`);

// Función para hacer la revisión
async function checkMetrics() {
  try {
    console.log('\n========================================');
    console.log(`🔍 Revisión automática: ${new Date().toLocaleString('es-ES')}`);
    console.log('========================================\n');

    const response = await fetch(`${API_URL}/api/push-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Revisión completada: ${data.checked} usuarios, ${data.alerts} alertas`);
    } else {
      console.error(`❌ Error en revisión: ${data.message}`);
    }

  } catch (error) {
    console.error('❌ Error al hacer polling:', error.message);
  }
}

// Primera revisión inmediata (después de 30 segundos)
setTimeout(() => {
  console.log('🏁 Primera revisión en 30 segundos...');
  checkMetrics();
}, 30000);

// Revisiones periódicas cada 15 minutos
setInterval(checkMetrics, POLLING_INTERVAL);

console.log('✅ Sistema de polling iniciado correctamente\n');

