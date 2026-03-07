export async function onRequestGet({ env }) {
  const botToken = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'TG_BOT_TOKEN is not configured',
        configured: false,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const apiDomain = proxyUrl ? `https://${proxyUrl}` : 'https://api.telegram.org';

  try {
    const botInfoResponse = await fetch(`${apiDomain}/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();

    if (!botInfo.ok) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid bot token',
          telegram_response: botInfo,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    let chatInfo = null;
    let chatError = null;

    if (chatId) {
      try {
        const chatInfoResponse = await fetch(`${apiDomain}/bot${botToken}/getChat?chat_id=${chatId}`);
        chatInfo = await chatInfoResponse.json();
      } catch (e) {
        chatError = e.message;
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        configured: true,
        proxy_enabled: !!proxyUrl,
        proxy_url: proxyUrl || 'not configured',
        bot_info: {
          id: botInfo.result.id,
          is_bot: botInfo.result.is_bot,
          first_name: botInfo.result.first_name,
          username: botInfo.result.username,
        },
        chat_configured: !!chatId,
        chat_id: chatId || 'not configured',
        chat_info: chatInfo,
        chat_error: chatError,
        recommendations: {
          chat_id_format: chatId && !chatId.startsWith('-100') ? 'Warning: Private channel/group IDs should start with -100' : 'OK',
          bot_admin: chatInfo?.ok && chatInfo?.result?.type === 'channel' ? 'Make sure the bot is an ADMIN in the channel' : null,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
