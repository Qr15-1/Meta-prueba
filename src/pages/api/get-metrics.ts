import type { APIRoute } from 'astro';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

// Deshabilitar pre-rendering
export const prerender = false;

/**
 * API Endpoint para obtener métricas REALES de Meta Ads
 */

export const POST: APIRoute = async ({ request }) => {
  console.log('\n========================================');
  console.log('OBTENIENDO MÉTRICAS REALES DE META ADS');
  console.log('========================================\n');

  try {
    // Obtener el token de acceso, fechas y accountId del body
    const { accessToken, dateStart, dateEnd, accountId: requestedAccountId } = await request.json();

    if (!accessToken) {
      console.error('Token de acceso no proporcionado');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Token de acceso requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token recibido:', accessToken.substring(0, 20) + '...');
    console.log('Rango de fechas:', { dateStart, dateEnd });
    console.log('AccountId solicitado:', requestedAccountId || 'Ninguno (usar primera cuenta)');

    let accountId: string;
    let accountName: string;
    let accountCurrency: string;

    // Si se especificó un accountId, usarlo directamente
    if (requestedAccountId) {
      accountId = requestedAccountId;
      
      // Obtener información de la cuenta específica
      const accountInfoUrl = `https://graph.facebook.com/v18.0/${accountId}?fields=id,name,currency&access_token=${accessToken}`;
      const accountInfoResponse = await fetch(accountInfoUrl);
      const accountInfo = await accountInfoResponse.json();
      
      if (accountInfo.error) {
        console.error('Error al obtener info de cuenta:', accountInfo.error);
        throw new Error(accountInfo.error.message);
      }
      
      accountName = accountInfo.name;
      accountCurrency = accountInfo.currency;
      console.log('Usando cuenta seleccionada:', accountName, '(', accountId, ')');
      
    } else {
      // Si no se especificó, obtener la primera cuenta disponible
      console.log('\nObteniendo primera cuenta disponible...');
      const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`;
      
      const adAccountsResponse = await fetch(adAccountsUrl);
      const adAccountsData = await adAccountsResponse.json();

      if (adAccountsData.error) {
        console.error('Error al obtener cuentas:', adAccountsData.error);
        return new Response(
          JSON.stringify({
            success: false,
            message: adAccountsData.error.message,
            needsPermissions: true
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!adAccountsData.data || adAccountsData.data.length === 0) {
        console.log('No se encontraron cuentas publicitarias');
        return new Response(
          JSON.stringify({
            success: false,
            message: 'No se encontraron cuentas publicitarias asociadas',
            hasNoAccounts: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const firstAccount = adAccountsData.data[0];
      accountId = firstAccount.id;
      accountName = firstAccount.name;
      accountCurrency = firstAccount.currency;
      console.log('Cuenta encontrada:', accountName, '(', accountId, ')');
    }

    // PASO 2: Obtener insights de la cuenta
    console.log('\nPaso 2: Obteniendo insights...');
    
    // Construir URL con rango de fechas personalizado o usar preset por defecto
    // Incluir métricas de costos + acciones para visitas al perfil
    let insightsUrl = `https://graph.facebook.com/v18.0/${accountId}/insights?fields=reach,impressions,clicks,ctr,spend,cpc,cpm,cpp,frequency,cost_per_unique_click,cost_per_inline_link_click,actions,cost_per_action_type`;
    
    if (dateStart && dateEnd) {
      // Usar rango de fechas personalizado
      insightsUrl += `&time_range={"since":"${dateStart}","until":"${dateEnd}"}`;
      console.log('Usando rango personalizado:', dateStart, 'hasta', dateEnd);
    } else {
      // Usar preset por defecto (últimos 30 días)
      insightsUrl += `&date_preset=last_30d`;
      console.log('Usando preset: últimos 30 días');
    }
    
    insightsUrl += `&access_token=${accessToken}`;
    console.log('URL de insights:', insightsUrl);
    
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    console.log('Insights:', JSON.stringify(insightsData, null, 2));
    
    // Debug: Ver las acciones disponibles
    if (insightsData.data && insightsData.data[0]?.actions) {
      console.log('Acciones disponibles:', insightsData.data[0].actions.map((a: any) => a.action_type));
    }

    // PASO 3: Obtener campañas CON sus métricas (SOLO las que están ENTREGANDO)
    console.log('\nPaso 3: Obteniendo campañas en entrega...');
    
    // Construir URL con métricas, rango de fechas y effective_status
    let campaignsUrl = `https://graph.facebook.com/v18.0/${accountId}/campaigns?fields=id,name,status,effective_status,insights`;
    
    // Agregar insights con métricas de costos + acciones
    campaignsUrl += `.time_range(`;
    if (dateStart && dateEnd) {
      campaignsUrl += `{'since':'${dateStart}','until':'${dateEnd}'}`;
    } else {
      campaignsUrl += `{'since':'2024-01-01','until':'${new Date().toISOString().split('T')[0]}'}`;
    }
    campaignsUrl += `){reach,impressions,clicks,ctr,spend,cpc,cpm,cpp,frequency,cost_per_unique_click,cost_per_inline_link_click,conversions,cost_per_action_type,actions}`;
    
    campaignsUrl += `&limit=50&access_token=${accessToken}`;
    
    console.log('URL de campañas:', campaignsUrl);
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    console.log('Campañas en entrega:', JSON.stringify(campaignsData, null, 2));
    console.log(`${campaignsData.data?.length || 0} campañas entregando activamente`);

    // PASO 4: Obtener Ad Sets con costos
    console.log('\nPaso 4: Obteniendo ad sets con costos...');
    const adSetsUrl = `https://graph.facebook.com/v18.0/${accountId}/adsets?fields=id,name,status,effective_status,insights.time_range({'since':'${dateStart}','until':'${dateEnd}'}){cpc,cpm,cpp,cost_per_inline_link_click,cost_per_action_type}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=100&access_token=${accessToken}`;
    
    const adSetsResponse = await fetch(adSetsUrl);
    const adSetsData = await adSetsResponse.json();
    
    console.log('Ad Sets obtenidos:', adSetsData.data?.length || 0);

    // PASO 5: Obtener Ads con costos
    console.log('\nPaso 5: Obteniendo ads con costos...');
    const adsUrl = `https://graph.facebook.com/v18.0/${accountId}/ads?fields=id,name,status,effective_status,insights.time_range({'since':'${dateStart}','until':'${dateEnd}'}){reach,impressions,clicks,ctr,spend,cpc,cpm,cpp,cost_per_inline_link_click,cost_per_action_type,actions}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=100&access_token=${accessToken}`;
    
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();
    
    console.log('Ads obtenidos:', adsData.data?.length || 0);

    const deliveredAdsCount = (adsData.data || []).filter((ad: any) => {
      const insights = ad.insights?.data && ad.insights.data.length > 0 ? ad.insights.data[0] : null;
      if (!insights) return false;
      const impressions = insights.impressions ? parseInt(insights.impressions) : 0;
      const spend = insights.spend ? parseFloat(insights.spend) : 0;
      return impressions > 0 || spend > 0;
    }).length;

    const ads = (adsData.data || [])
      .map((ad: any) => {
        const insights = ad.insights?.data && ad.insights.data.length > 0 ? ad.insights.data[0] : null;
        if (!insights) return null;

        const messagingConversations = (() => {
          if (insights.actions && Array.isArray(insights.actions)) {
            const messagingAction = insights.actions.find((action: any) =>
              action.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
              action.action_type === 'messaging_conversation_started_7d' ||
              action.action_type === 'onsite_conversion.messaging_first_reply'
            );
            return messagingAction ? parseInt(messagingAction.value) : 0;
          }
          return 0;
        })();

        return {
          id: ad.id,
          name: ad.name,
          status: ad.status?.toLowerCase?.() || 'active',
          effectiveStatus: ad.effective_status,
          spend: insights.spend ? parseFloat(insights.spend) : 0,
          reach: insights.reach ? parseInt(insights.reach) : 0,
          impressions: insights.impressions ? parseInt(insights.impressions) : 0,
          clicks: insights.clicks ? parseInt(insights.clicks) : 0,
          ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
          messagingConversations
        };
      })
      .filter(Boolean);

    // Calcular mejores costos (más bajos) - SOLO ANUNCIOS
    const calculateBestCosts = () => {
      const allItems: any[] = [];
      
      // Solo agregar ads (anuncios individuales)
      if (adsData.data && Array.isArray(adsData.data)) {
        adsData.data.forEach((ad: any) => {
          const insights = ad.insights?.data && ad.insights.data.length > 0 ? ad.insights.data[0] : null;
          if (insights) {
            const costPerMessaging = insights.cost_per_action_type?.find((cost: any) =>
              cost.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
              cost.action_type === 'messaging_conversation_started_7d' ||
              cost.action_type === 'onsite_conversion.messaging_first_reply'
            );

            allItems.push({
              type: 'Anuncio',
              name: ad.name,
              cpc: insights.cpc ? parseFloat(insights.cpc) : Infinity,
              cpm: insights.cpm ? parseFloat(insights.cpm) : Infinity,
              cpp: insights.cpp ? parseFloat(insights.cpp) : Infinity,
              costPerLinkClick: insights.cost_per_inline_link_click ? parseFloat(insights.cost_per_inline_link_click) : Infinity,
              costPerMessaging: costPerMessaging ? parseFloat(costPerMessaging.value) : Infinity
            });
          }
        });
      }

      // Encontrar los mejores (más bajos) en cada métrica
      const findLowest = (metric: string) => {
        const valid = allItems.filter(item => item[metric] !== Infinity && item[metric] > 0);
        if (valid.length === 0) return null;
        return valid.reduce((min, item) => item[metric] < min[metric] ? item : min);
      };

      return {
        lowestCostPerMessaging: findLowest('costPerMessaging'),
        lowestCPC: findLowest('cpc'),
        lowestCPM: findLowest('cpm'),
        lowestCPP: findLowest('cpp'),
        lowestCostPerLinkClick: findLowest('costPerLinkClick')
      };
    };

    const bestCosts = calculateBestCosts();
    console.log('Mejores costos calculados:', JSON.stringify(bestCosts, null, 2));

    // Procesar insights reales
    const insights = insightsData.data && insightsData.data.length > 0 ? insightsData.data[0] : null;

    if (!insights) {
      console.log('No hay datos de insights disponibles');
    }

    // Formatear el período para mostrar
    let periodText = 'Últimos 30 días';
    if (dateStart && dateEnd) {
      periodText = `${dateStart} al ${dateEnd}`;
    }

    const realMetrics = {
      success: true,
      timestamp: new Date().toISOString(),
      period: periodText,
      dateRange: { dateStart, dateEnd },
      account: {
        id: accountId,
        name: accountName,
        currency: accountCurrency || 'USD'
      },
      metrics: {
        reach: {
          value: insights?.reach ? parseInt(insights.reach) : 0,
          change: 0,
          label: 'Alcance',
          description: 'Personas únicas alcanzadas'
        },
        impressions: {
          value: insights?.impressions ? parseInt(insights.impressions) : 0,
          change: 0,
          label: 'Impresiones',
          description: 'Total de visualizaciones'
        },
        clicks: {
          value: insights?.clicks ? parseInt(insights.clicks) : 0,
          change: 0,
          label: 'Clics',
          description: 'Clics en anuncios'
        },
        ctr: {
          value: insights?.ctr ? parseFloat(insights.ctr) : 0,
          change: 0,
          label: 'CTR (%)',
          description: 'Tasa de clics'
        },
        spend: {
          value: insights?.spend ? parseFloat(insights.spend) : 0,
          change: 0,
          label: 'Gasto Total ($)',
          description: 'Inversión publicitaria total'
        },
        cpc: {
          value: insights?.cpc ? parseFloat(insights.cpc) : 0,
          change: 0,
          label: 'Costo por Clic ($)',
          description: 'Costo promedio por clic'
        },
        cpm: {
          value: insights?.cpm ? parseFloat(insights.cpm) : 0,
          change: 0,
          label: 'CPM ($)',
          description: 'Costo por mil impresiones'
        },
        messagingConversations: {
          value: (() => {
            // Buscar mensajes iniciados en las acciones
            if (insights?.actions && Array.isArray(insights.actions)) {
              const messagingAction = insights.actions.find((action: any) => 
                action.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                action.action_type === 'messaging_conversation_started_7d' ||
                action.action_type === 'onsite_conversion.messaging_first_reply'
              );
              return messagingAction ? parseInt(messagingAction.value) : 0;
            }
            return 0;
          })(),
          change: 0,
          label: 'Mensajes Iniciados',
          description: 'Conversaciones iniciadas por usuarios'
        },
        
        //  NUEVAS MÉTRICAS DE COSTOS EN ESPAÑOL
        
        costPerMessaging: {
          value: (() => {
            // Calcular costo por mensaje iniciado
            const messages = (() => {
              if (insights?.actions && Array.isArray(insights.actions)) {
                const messagingAction = insights.actions.find((action: any) => 
                  action.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                  action.action_type === 'messaging_conversation_started_7d' ||
                  action.action_type === 'onsite_conversion.messaging_first_reply'
                );
                return messagingAction ? parseInt(messagingAction.value) : 0;
              }
              return 0;
            })();
            
            if (messages > 0 && insights?.spend) {
              return parseFloat(insights.spend) / messages;
            }
            
            // Si no hay mensajes, buscar en cost_per_action_type
            if (insights?.cost_per_action_type && Array.isArray(insights.cost_per_action_type)) {
              const costPerMessage = insights.cost_per_action_type.find((cost: any) =>
                cost.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                cost.action_type === 'messaging_conversation_started_7d' ||
                cost.action_type === 'onsite_conversion.messaging_first_reply'
              );
              return costPerMessage ? parseFloat(costPerMessage.value) : 0;
            }
            
            return 0;
          })(),
          change: 0,
          label: 'Costo por Mensaje Iniciado ($)',
          description: 'Inversión por cada conversación iniciada'
        },
        cpp: {
          value: insights?.cpp ? parseFloat(insights.cpp) : 0,
          change: 0,
          label: 'Costo por Alcance ($)',
          description: 'Costo por mil personas alcanzadas'
        },
        frequency: {
          value: insights?.frequency ? parseFloat(insights.frequency) : 0,
          change: 0,
          label: 'Frecuencia',
          description: 'Veces promedio que se ve el anuncio'
        },
        costPerUniqueClick: {
          value: insights?.cost_per_unique_click ? parseFloat(insights.cost_per_unique_click) : 0,
          change: 0,
          label: 'Costo por Clic Único ($)',
          description: 'Costo por clic sin duplicados'
        },
        costPerLinkClick: {
          value: insights?.cost_per_inline_link_click ? parseFloat(insights.cost_per_inline_link_click) : 0,
          change: 0,
          label: 'Costo por Clic en Enlace ($)',
          description: 'Costo específico por clic en enlaces'
        },
        profileVisits: {
          value: (() => {
            // Buscar visitas al perfil en las acciones
            if (insights?.actions && Array.isArray(insights.actions)) {
              const profileAction = insights.actions.find((action: any) => 
                action.action_type === 'landing_page_view' || 
                action.action_type === 'link_click' ||
                action.action_type === 'onsite_conversion.post_save'
              );
              return profileAction ? parseInt(profileAction.value) : 0;
            }
            return 0;
          })(),
          change: 0,
          label: 'Visitas al Perfil',
          description: 'Visitas al perfil de Instagram'
        }
      },
      campaigns: campaignsData.data ? campaignsData.data
        // Incluir campañas con delivery real (impressions o gasto)
        .filter((camp: any) => {
          const campInsights = camp.insights?.data && camp.insights.data.length > 0 ? camp.insights.data[0] : null;
          const hasImpressions = campInsights && parseInt(campInsights.impressions || 0) > 0;
          const hasSpend = campInsights && parseFloat(campInsights.spend || 0) > 0;
          
          console.log(`Campaña "${camp.name}":
            - effective_status: ${camp.effective_status}
            - status: ${camp.status}
            - impressions: ${campInsights?.impressions || 0}
            - spend: $${campInsights?.spend || 0}
            - Pasa filtro: ${hasImpressions || hasSpend}`);
          
          return hasImpressions || hasSpend;
        })
        .map((camp: any) => {
          // Obtener el primer insight de la campaña (si existe)
          const campInsights = camp.insights?.data && camp.insights.data.length > 0 ? camp.insights.data[0] : null;
          
          // Buscar mensajes iniciados en las acciones de la campaña
          const messagingConversations = (() => {
            if (campInsights?.actions && Array.isArray(campInsights.actions)) {
              const messagingAction = campInsights.actions.find((action: any) => 
                action.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                action.action_type === 'messaging_conversation_started_7d' ||
                action.action_type === 'onsite_conversion.messaging_first_reply'
              );
              return messagingAction ? parseInt(messagingAction.value) : 0;
            }
            return 0;
          })();
          
          // Buscar costo por mensaje en cost_per_action_type
          const costPerMessaging = (() => {
            if (campInsights?.cost_per_action_type && Array.isArray(campInsights.cost_per_action_type)) {
              const messagingCost = campInsights.cost_per_action_type.find((cost: any) =>
                cost.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                cost.action_type === 'messaging_conversation_started_7d' ||
                cost.action_type === 'onsite_conversion.messaging_first_reply'
              );
              return messagingCost ? parseFloat(messagingCost.value) : 0;
            }
            return 0;
          })();

          return {
            id: camp.id,
            name: camp.name,
            status: camp.status.toLowerCase(),
            effectiveStatus: camp.effective_status,
            spend: campInsights?.spend ? parseFloat(campInsights.spend) : 0,
            reach: campInsights?.reach ? parseInt(campInsights.reach) : 0,
            impressions: campInsights?.impressions ? parseInt(campInsights.impressions) : 0,
            clicks: campInsights?.clicks ? parseInt(campInsights.clicks) : 0,
            ctr: campInsights?.ctr ? parseFloat(campInsights.ctr) : 0,
            messagingConversations: messagingConversations,
            // Agregar métricas de costos para sistema de alertas
            cpc: campInsights?.cpc ? parseFloat(campInsights.cpc) : 0,
            cpm: campInsights?.cpm ? parseFloat(campInsights.cpm) : 0,
            cpp: campInsights?.cpp ? parseFloat(campInsights.cpp) : 0,
            costPerLinkClick: campInsights?.cost_per_inline_link_click ? parseFloat(campInsights.cost_per_inline_link_click) : 0,
            costPerMessaging: costPerMessaging
          };
        }) : [],
      ads,
      bestCosts: bestCosts,
      deliveredAdsCount: deliveredAdsCount,
      note: insights 
        ? `Datos reales de ${accountName} (${insights ? 'Con métricas' : 'Sin métricas'})` 
        : 'No hay datos publicitarios en esta cuenta en los últimos 30 días.'
    };

    console.log('Métricas REALES obtenidas exitosamente\n');
    console.log('========================================\n');

    return new Response(
      JSON.stringify(realMetrics),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error al obtener métricas:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Error al obtener métricas',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};


