import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { pool } from '../../../lib/db';
import { createSessionToken } from '../../../portal/lib/session';

function parseBody(body: any) {
  const email = String(body?.email || '').trim();
  const password = String(body?.password || '');
  return { email, password };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = parseBody(body);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Usuario y contraseña requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, marca_id FROM usuarios_portal WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = result.rows[0];
    const isBcrypt = String(user.password_hash || '').startsWith('$2');
    const valid = isBcrypt
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = createSessionToken({
      id: user.id,
      marcaId: user.marca_id,
      email: user.email
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `portal_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
      }
    });
  } catch (error) {
    console.error('Error en login portal:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
