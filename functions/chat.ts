// functions/api/chat.ts (или .js)

// Типы для контекста (если используете TypeScript)
// interface Env {
//   // Переменные окружения, например, биндинги к AI, KV, D1 и т.д.
//   AI: any;
// }
// interface RequestBody {
//   messages: { role: string; content: string }[];
// }

// Обработчик для POST-запросов
export async function onRequestPost(context) {
  // context содержит:
  // context.request: объект Request
  // context.env: переменные окружения (AI, KV, D1, etc.)
  // context.params: параметры пути (если есть, например /api/items/:id)
  // context.waitUntil: для задач, которые должны завершиться после ответа
  // context.next: для middleware
  // context.data: объект для передачи данных между middleware

  try {
    const { request, env } = context;
    const body = await request.json(); // Парсим тело запроса как JSON
    const messages = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request body, "messages" array is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Здесь ваша логика взаимодействия с AI, например, Cloudflare Workers AI
    // Пример с заглушкой:
    // const aiResponse = await env.AI.run(
    //   '@cf/meta/llama-2-7b-chat-fp16', // или другая модель
    //   { messages }
    // );

    const mockAiResponse = {
      role: 'assistant',
      content: "Привет! Я получил твои сообщения: " + messages.map(m => m.content).join("; ")
    };

    return new Response(JSON.stringify(mockAiResponse), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("Error in onRequestPost:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ВАЖНО для локальной разработки с `ng serve` и `wrangler dev` (разные порты):
// Вам также нужен обработчик для OPTIONS запросов (preflight request for CORS)
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // В продакшене лучше указать конкретный домен вашего Angular приложения
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', // Разрешаем POST
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Разрешаем заголовки, которые шлет клиент
      'Access-Control-Max-Age': '86400', // 24 часа
    },
  });
}

// functions/api/chat.ts
export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    // Обработка preflight CORS запроса
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method === "POST") {
    // Ваша логика для POST
    // ... (как в примере onRequestPost выше)
    const body = await request.json();
    // ...
    return new Response(JSON.stringify({ role: "assistant", content: "Processed POST" }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Для других методов, если они не поддерживаются
  return new Response("Method Not Allowed", { status: 405 });
}
