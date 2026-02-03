import type { APIRoute } from 'astro';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../../.env') });

/**
 * API Endpoint para intercambiar código OAuth por token de acceso
 * Este endpoint DEBE ejecutarse en el servidor, no pre-renderizarse
 */

// Deshabilitar pre-rendering para que funcione como servidor dinámico
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log('\n========================================');
  console.log(' INICIO DEL PROCESO DE EXCHANGE TOKEN');
  console.log('========================================\n');

  try {
    // Leer el código del body
    const body = await request.json();
    const { code } = body;

    console.log(' Body recibido:', body);
    console.log(' Código OAuth recibido:', code ? code.substring(0, 20) + '...' : 'NO RECIBIDO');

    if (!code) {
      console.error(' ERROR: Código no proporcionado');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Código no proporcionado'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Leer variables de entorno
    const META_APP_ID = process.env.META_APP_ID || import.meta.env.META_APP_ID || "1165184268021156";
    const META_APP_SECRET = process.env.META_APP_SECRET || import.meta.env.META_APP_SECRET || "b8912c5a3056cf9bbc372faadf4240f3";
    const REDIRECT_URI = process.env.PUBLIC_REDIRECT_URI || "http://localhost:4321/auth/callback";

    console.log('🔍 Variables de entorno:');
    console.log('   APP_ID:', META_APP_ID ? ' ' + META_APP_ID : ' NO ENCONTRADO');
    console.log('   APP_SECRET:', META_APP_SECRET ? ' ' + META_APP_SECRET.substring(0, 10) + '...' : ' NO ENCONTRADO');
    console.log('   REDIRECT_URI:', REDIRECT_URI);

    console.log('\n Intercambiando código por token...');

    // Intercambiar código por token de acceso
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${META_APP_SECRET}&code=${code}`;

    console.log(' URL completa para Meta:');
    console.log('   ', tokenUrl);
    console.log('');

    console.log(' Haciendo petición a Meta Graph API...');
    const tokenResponse = await fetch(tokenUrl);
    
    console.log(' Status de respuesta:', tokenResponse.status, tokenResponse.statusText);
    
    const responseText = await tokenResponse.text();
    
    console.log(' Respuesta completa de Meta:');
    console.log('   ', responseText);
    console.log('');

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      console.error(' Error parseando JSON:', responseText);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Respuesta inválida de Meta',
          details: responseText.substring(0, 200)
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (tokenData.error) {
      console.error(' Error de Meta:', tokenData.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: tokenData.error.message || 'Error al obtener token',
          error_code: tokenData.error.code,
          error_subcode: tokenData.error.error_subcode
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;

    // Obtener información del usuario
    const userUrl = `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${accessToken}`;
    const userResponse = await fetch(userUrl);
    const userData = await userResponse.json();

    console.log(' Token obtenido para usuario:', userData.name);

    return new Response(
      JSON.stringify({
        success: true,
        accessToken,
        userId: userData.id,
        userName: userData.name,
        userEmail: userData.email,
        message: '¡Autenticación exitosa!'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('\n ERROR CRÍTICO EN EXCHANGE-TOKEN ');
    console.error('Tipo de error:', error.name);
    console.error('Mensaje:', error.message);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('========================================\n');
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor: ' + error.message,
        error_type: error.name
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

