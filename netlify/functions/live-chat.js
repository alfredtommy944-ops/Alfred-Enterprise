import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-owner-upload-key, x-profile-upload-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

function isAuthorizedOwner(event) {
  const expected = (
    process.env.OWNER_UPLOAD_KEY ||
    process.env.PROFILE_UPLOAD_KEY ||
    ""
  ).trim();
  if (!expected) return false;
  const provided = (
    event.headers["x-owner-upload-key"] ||
    event.headers["x-profile-upload-key"] ||
    ""
  ).trim();
  return provided === expected;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const store = getStore("alfred-enterprise-chat");
  const params = event.queryStringParameters || {};

  try {
    if (event.httpMethod === "GET") {
      // Owner listing all active conversations
      if (params.all === "1") {
        if (!isAuthorizedOwner(event)) {
          return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
        }
        const indexData = (await store.get("chat_index", { type: "json" })) || [];
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ conversations: indexData })
        };
      }

      // Single customer thread
      const chatId = (params.chatId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      if (!chatId) {
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ messages: [] }) };
      }
      const thread = (await store.get(`thread_${chatId}`, { type: "json" })) || { messages: [] };
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ messages: thread.messages || [] })
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const chatId = (body.chatId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      const text = (body.text || "").trim().slice(0, 1000);
      const sender = body.sender === "owner" ? "owner" : "customer";
      const customerName = (body.customerName || "Customer").trim().slice(0, 60);

      if (!chatId || !text) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing chatId or message" }) };
      }

      if (sender === "owner" && !isAuthorizedOwner(event)) {
        return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid owner login key" }) };
      }

      const threadKey = `thread_${chatId}`;
      const existing = (await store.get(threadKey, { type: "json" })) || {
        chatId,
        customerName,
        messages: []
      };

      if (sender === "customer" && customerName) {
        existing.customerName = customerName;
      }

      const msgObj = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        sender,
        text,
        time: new Date().toISOString()
      };

      existing.messages.push(msgObj);
      if (existing.messages.length > 100) {
        existing.messages = existing.messages.slice(-100);
      }
      await store.setJSON(threadKey, existing);

      // Update summary index for Owner Mode
      let indexList = (await store.get("chat_index", { type: "json" })) || [];
      indexList = indexList.filter((c) => c.chatId !== chatId);
      indexList.unshift({
        chatId,
        customerName: existing.customerName || "Customer",
        lastMessage: text,
        lastSender: sender,
        updatedAt: msgObj.time
      });
      if (indexList.length > 50) {
        indexList = indexList.slice(0, 50);
      }
      await store.setJSON("chat_index", indexList);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: true, messages: existing.messages })
      };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || "Chat server error" })
    };
  }
}
