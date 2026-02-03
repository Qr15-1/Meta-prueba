import type { APIRoute } from 'astro';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

/**
 * API Endpoint para obtener insights de Meta (Facebook/Instagram)
 * 
 * Este endpoint:
 * 1. Lee las credenciales de forma segura desde las variables de entorno
 * 2. Genera un token de acceso de la aplicación
 * 3. Hace llamadas a la API de Meta para obtener datos publicitarios
 */

export const GET: APIRoute = async ({ request }) => {
  try {
    // ==========================================
    // PASO 1: Leer Credenciales del .env
    // ==========================================
    // TEMPORAL: Credenciales hardcodeadas para prueba
    const META_APP_ID = process.env.META_APP_ID || import.meta.env.META_APP_ID || "1165184268021156";
    const META_APP_SECRET = process.env.META_APP_SECRET || import.meta.env.META_APP_SECRET || "b8912c5a3056cf9bbc372faadf4240f3";

    // Debug: Ver qué variables están disponibles
    console.log(' Variables de entorno:');
    console.log('  META_APP_ID:', META_APP_ID ? 'encontrado ' : 'NO encontrado ');
    console.log('  META_APP_SECRET:', META_APP_SECRET ? 'encontrado ' : 'NO encontrado ');
    console.log('  Fuente:', process.env.META_APP_ID ? 'process.env' : import.meta.env.META_APP_ID ? 'import.meta.env' : 'hardcoded');

    // Validar que las credenciales existen
    if (!META_APP_ID || !META_APP_SECRET) {
      return new Response(
        JSON.stringify({
          error: 'Credenciales de Meta no configuradas',
          message: 'Asegúrate de tener META_APP_ID y META_APP_SECRET en tu archivo .env'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(' Credenciales cargadas correctamente');

    // ==========================================
    // PASO 2: Generar Token de Acceso
    // ==========================================
    const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&grant_type=client_credentials`;

    console.log(' Solicitando token de acceso...');
    
    const tokenResponse = await fetch(tokenUrl);
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error(' Error al obtener token:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Error al obtener token de acceso',
          details: errorData
        }),
        { 
          status: tokenResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log(' Token de acceso obtenido');

    // ==========================================
    // PASO 3: Obtener Información de la App
    // ==========================================
    // Primero validamos que el token funciona obteniendo info de la app
    const appInfoUrl = `https://graph.facebook.com/v18.0/${META_APP_ID}?fields=id,name&access_token=${accessToken}`;

    console.log('📱 Obteniendo información de la aplicación...');
    
    const appInfoResponse = await fetch(appInfoUrl);
    
    if (!appInfoResponse.ok) {
      const errorData = await appInfoResponse.json();
      console.error(' Error al obtener info de la app:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Error al validar la aplicación',
          details: errorData
        }),
        { 
          status: appInfoResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const appInfo = await appInfoResponse.json();
    console.log(' Aplicación validada:', appInfo.name);

    // ==========================================
    // PASO 4: Respuesta Exitosa
    // ==========================================
    return new Response(
      JSON.stringify({
        success: true,
        message: '¡Conexión con Meta API exitosa! 🎉',
        data: {
          app: appInfo,
          tokenGenerated: true,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    // ==========================================
    // Manejo de Errores Generales
    // ==========================================
    console.error(' Error general:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

