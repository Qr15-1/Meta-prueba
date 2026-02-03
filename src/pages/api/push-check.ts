import type { APIRoute } from 'astro';
import * as fs from 'fs';
import * as path from 'path';
import * as webpush from 'web-push';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Deshabilitar pre-rendering
export const prerender = false;

// Configurar web-push con claves VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BBfWUB5mmTVWWaomnpSwrQtPjjjPKhhfNE2XgcznY2FPY3A9eIx3oUkYL_iYqqtvFh4s5Gvii6NybJxRjTJGbaM';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'fu_v84eJxAnvjL7CiY5KbKs1EnhDTYc6KPl68RZD-OI';

webpush.setVapidDetails(
  'mailto:admin@metaia.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'push-subscriptions.json');

// Métricas a monitorear
const METRICS_TO_MONITOR = [
  'costPerMessaging',
  'cpc',
  'cpm',
  'cpp',
  'costPerLinkClick'
];

const METRIC_LABELS: { [key: string]: string } = {
  costPerMessaging: 'Costo por Mensaje Iniciado',
  cpc: 'Costo por Clic (CPC)',
  cpm: 'CPM',
  cpp: 'Costo por Alcance',
  costPerLinkClick: 'Costo por Clic en Enlace'
};

/**
 * Endpoint para hacer polling y enviar notificaciones push
 * Este endpoint debería ser llamado por un CRON job cada 15 minutos
 */
export const POST: APIRoute = async ({ request }) => {
  console.log('\n========================================');
  console.log('  REVISIÓN PUSH AUTOMÁTICA');
  console.log('========================================\n');

  try {
    // Verificar que exista el archivo de suscripciones
    if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
      console.log(' No hay suscripciones registradas');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay suscripciones',
          checked: 0,
          alerts: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Leer suscripciones
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
    const subscriptions = JSON.parse(data);

    if (subscriptions.length === 0) {
      console.log('⚠️ No hay usuarios suscritos');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay usuarios suscritos',
          checked: 0,
          alerts: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(` ${subscriptions.length} usuario(s) suscrito(s)`);

    let totalAlerts = 0;
    let totalChecks = 0;

    // Revisar cada usuario
    for (const userSub of subscriptions) {
      try {
        console.log(`\n👤 Revisando usuario: ${userSub.userId}`);
        
        // Aquí llamamos a la API para obtener métricas de cada cuenta del usuario
        // Por ahora, simularemos que no hay cambios para no sobrecargar
        // En producción, aquí iría la lógica real de polling
        
        totalChecks++;
        
      } catch (error) {
        console.error(` Error al revisar usuario ${userSub.userId}:`, error);
      }
    }

    console.log(`\n Revisión completada: ${totalChecks} usuarios, ${totalAlerts} alertas`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Revisión completada',
        checked: totalChecks,
        alerts: totalAlerts
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(' Error en revisión push:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Error interno del servidor'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Envía una notificación push a un dispositivo
 */
async function sendPushNotification(subscription: any, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log(' Push notification enviada');
  } catch (error: any) {
    console.error(' Error al enviar push:', error);
    
    // Si la suscripción es inválida, eliminarla
    if (error.statusCode === 410) {
      console.log(' Suscripción expirada, debe ser eliminada');
    }
  }
}

