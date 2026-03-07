export async function onRequestGet({ env }) {
  const botToken = env.TG_BOT_TOKEN;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'TG_BOT_TOKEN is not configured',
      configured: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiDomain = proxyUrl ? `https://${proxyUrl}` : 'https://api.telegram.org';
    const response = await fetch(`${apiDomain}/bot${botToken}/getMe`);
    const data = await response.json();

    return new Response(JSON.stringify({
      status: 'ok',
      configured: true,
      proxy_enabled: !!proxyUrl,
      proxy_url: proxyUrl || 'not configured',
      bot_info: data.ok ? {
        id: data.result.id,
        is_bot: data.result.is_bot,
        first_name: data.result.first_name,
        username: data.result.username
      } : null,
      telegram_response: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
