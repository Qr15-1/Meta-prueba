import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

let ensuredSavedAt = false;

async function ensureSavedAtColumn() {
  if (ensuredSavedAt) return;
  await pool.query(
    'ALTER TABLE metricas_historial ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ DEFAULT now()'
  );
  ensuredSavedAt = true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await ensureSavedAtColumn();
    const body = await request.json();
    const {
      adAccountId,
      date,
      spend,
      impressions,
      clicks,
      reach,
      messages,
      ctr,
      cpc,
      cpm,
      frequency,
      cost_per_unique_click,
      cost_per_link_click,
      profile_visits,
      cost_per_messaging,
      delivered_ads_count
    } = body;

    const cleanAccountId = String(adAccountId || '').replace('act_', '');
    const clientResult = await pool.query(
      'SELECT id FROM marcas WHERE meta_account_id = $1',
      [cleanAccountId]
    );

    if (clientResult.rows.length === 0) {
      console.error(`Marca no encontrada para el ID de Meta: ${cleanAccountId}`);
      return new Response(JSON.stringify({ error: 'Marca no registrada' }), { status: 404 });
    }

    const marcaId = clientResult.rows[0].id;

    const query = `
      INSERT INTO metricas_historial
      (marca_id, fecha, alcance, impresiones, clics, gasto, mensajes_iniciados,
       ctr, cpc, cpm, frequency, cost_per_unique_click, cost_per_link_click,
       profile_visits, cost_per_messaging, delivered_ads_count, saved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
      ON CONFLICT (marca_id, fecha)
      DO UPDATE SET
        alcance = EXCLUDED.alcance,
        impresiones = EXCLUDED.impresiones,
        clics = EXCLUDED.clics,
        gasto = EXCLUDED.gasto,
        mensajes_iniciados = EXCLUDED.mensajes_iniciados,
        ctr = EXCLUDED.ctr,
        cpc = EXCLUDED.cpc,
        cpm = EXCLUDED.cpm,
        frequency = EXCLUDED.frequency,
        cost_per_unique_click = EXCLUDED.cost_per_unique_click,
        cost_per_link_click = EXCLUDED.cost_per_link_click,
        profile_visits = EXCLUDED.profile_visits,
        cost_per_messaging = EXCLUDED.cost_per_messaging,
        delivered_ads_count = EXCLUDED.delivered_ads_count,
        saved_at = now();
    `;

    await pool.query(query, [
      marcaId,
      date,
      reach,
      impressions,
      clicks,
      spend,
      messages,
      ctr,
      cpc,
      cpm,
      frequency,
      cost_per_unique_click,
      cost_per_link_click,
      profile_visits,
      cost_per_messaging,
      delivered_ads_count
    ]);

    return new Response(JSON.stringify({ success: true, message: 'Datos guardados en Postgres' }), {
      status: 200
    });
  } catch (error) {
    console.error('Error en daily-metrics:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};
