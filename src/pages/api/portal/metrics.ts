import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { verifySessionToken } from '../../../portal/lib/session';

let ensuredSavedAt = false;

async function ensureSavedAtColumn() {
  if (ensuredSavedAt) return;
  await pool.query(
    'ALTER TABLE metricas_historial ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ DEFAULT now()'
  );
  ensuredSavedAt = true;
}

function getCookie(header: string | null, name: string) {
  if (!header) return null;
  const cookies = header.split(';').map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.split('=')[1]) : null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await ensureSavedAtColumn();
    const token = getCookie(request.headers.get('cookie'), 'portal_session');
    const session = verifySessionToken(token);
    if (!session) {
      return new Response(JSON.stringify({ error: 'No auth' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await pool.query(
      `SELECT fecha, alcance, impresiones, clics, gasto, mensajes_iniciados,
              ctr, cpc, cpm, frequency, cost_per_unique_click, cost_per_link_click,
              profile_visits, cost_per_messaging, delivered_ads_count
       FROM metricas_historial
       WHERE marca_id = $1
       ORDER BY saved_at DESC, fecha DESC
       LIMIT 1`,
      [session.marcaId]
    );

    return new Response(JSON.stringify({ data: result.rows[0] || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en portal/metrics:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
