import type { APIRoute } from 'astro';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deshabilitar pre-rendering
export const prerender = false;

// Ruta al archivo de suscripciones
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'push-subscriptions.json');

/**
 * API Endpoint para guardar suscripciones push
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { subscription, userId, accountIds } = body;

    if (!subscription || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Suscripción y userId son requeridos'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Leer suscripciones existentes
    let subscriptions: any[] = [];
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      subscriptions = JSON.parse(data);
    }

    // Buscar si ya existe una suscripción para este usuario
    const existingIndex = subscriptions.findIndex(sub => sub.userId === userId);
    
    const newSubscription = {
      userId,
      subscription,
      accountIds: accountIds || [],
      createdAt: new Date().toISOString(),
      lastCheck: null
    };

    if (existingIndex >= 0) {
      // Actualizar suscripción existente
      subscriptions[existingIndex] = newSubscription;
    } else {
      // Agregar nueva suscripción
      subscriptions.push(newSubscription);
    }

    // Guardar en archivo
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));

    console.log(` Suscripción guardada para usuario: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Suscripción guardada correctamente'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error al guardar suscripción:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Error interno del servidor'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

