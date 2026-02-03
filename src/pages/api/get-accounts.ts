import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Token de acceso no proporcionado'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('========================================');
    console.log('OBTENIENDO CUENTAS PUBLICITARIAS');
    console.log('========================================');

    // OBTENER LAS CUENTAS PUBLICITARIAS
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`;
    
    console.log('URL:', adAccountsUrl);
    
    const adAccountsResponse = await fetch(adAccountsUrl);
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsResponse.ok) {
      console.error('Error de Meta API:', adAccountsData);
      throw new Error(adAccountsData.error?.message || 'Error al obtener cuentas publicitarias');
    }

    console.log('Respuesta:', JSON.stringify(adAccountsData, null, 2));

    if (!adAccountsData.data || adAccountsData.data.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        accounts: [],
        message: 'No tienes cuentas publicitarias disponibles'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Devolver todas las cuentas (activas e inactivas)
    const allAccounts = adAccountsData.data;

    console.log(`${allAccounts.length} cuentas encontradas (activas e inactivas)`);
    console.log('========================================');

    return new Response(JSON.stringify({
      success: true,
      accounts: allAccounts.map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        status: acc.account_status
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('ERROR EN GET-ACCOUNTS:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message || 'Error al obtener cuentas publicitarias'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

