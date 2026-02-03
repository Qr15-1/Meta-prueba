import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { verifySessionToken } from '../../../portal/lib/session';

function getCookie(header: string | null, name: string) {
  if (!header) return null;
  const cookies = header.split(';').map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.split('=')[1]) : null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const token = getCookie(request.headers.get('cookie'), 'portal_session');
    const session = verifySessionToken(token);
    if (!session) {
      return new Response(JSON.stringify({ error: 'No auth' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const marcaResult = await pool.query(
      'SELECT id, nombre, meta_account_id FROM marcas WHERE id = $1 LIMIT 1',
      [session.marcaId]
    );

    return new Response(
      JSON.stringify({
        user: { id: session.id, email: session.email },
        marca: marcaResult.rows[0] || null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en portal/me:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
