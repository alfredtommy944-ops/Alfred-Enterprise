import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
  };

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers });

  try {
    if (req.method === "GET") {
      const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
      if (!publicKey) {
        return new Response(JSON.stringify({ error: "Missing VAPID_PUBLIC_KEY" }), { status: 500, headers });
      }
      return new Response(JSON.stringify({ publicKey }), { status: 200, headers });
    }

    const store = getStore("alfred-enterprise-store");
    const existing = await store.get("push-subscriptions", { type: "json" });
    let list = existing && Array.isArray(existing.subscriptions) ? existing.subscriptions : [];

    if (req.method === "POST") {
      const body = await req.json();
      const sub = body && body.subscription;
      if (!sub || !sub.endpoint || !sub.keys) {
        return new Response(JSON.stringify({ error: "Invalid subscription" }), { status: 400, headers });
      }
      const idx = list.findIndex((item) => item.endpoint === sub.endpoint);
      const record = { ...sub, subscribedAt: new Date().toISOString() };
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      await store.setJSON("push-subscriptions", { subscriptions: list });
      return new Response(JSON.stringify({ ok: true, count: list.length }), { status: 200, headers });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      const endpoint = body && body.endpoint;
      list = list.filter((item) => item.endpoint !== endpoint);
      await store.setJSON("push-subscriptions", { subscriptions: list });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Error" }), { status: 500, headers });
  }
};

