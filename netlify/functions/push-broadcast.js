import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-profile-upload-key, x-owner-upload-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

  try {
    const incomingKey = String(
      req.headers.get("x-profile-upload-key") || req.headers.get("x-owner-upload-key") || ""
    ).trim();
    const expectedKey = String(process.env.OWNER_UPLOAD_KEY || process.env.PROFILE_UPLOAD_KEY || "").trim();

    if (!expectedKey || incomingKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
    const subject = String(process.env.VAPID_SUBJECT || "mailto:alfredenterprise@example.com").trim();

    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID keys" }), { status: 500, headers });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json().catch(() => ({}));
    const payload = JSON.stringify({
      title: String(body.title || "Alfred Enterprise — New Drop!").trim(),
      body: String(body.body || "New items are now available at IDA, Kenema City.").trim(),
      url: String(body.url || "/#store-section").trim(),
      tag: `alfred-drop-${Date.now()}`
    });

    const store = getStore("alfred-enterprise-store");
    const existing = await store.get("push-subscriptions", { type: "json" });
    const subscriptions = existing && Array.isArray(existing.subscriptions) ? existing.subscriptions : [];

    let sent = 0;
    const active = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload, { TTL: 86400, urgency: "high" });
          sent++;
          active.push(sub);
        } catch (err) {
          if (!err || (err.statusCode !== 404 && err.statusCode !== 410)) {
            active.push(sub);
          }
        }
      })
    );

    if (active.length !== subscriptions.length) {
      await store.setJSON("push-subscriptions", { subscriptions: active });
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Broadcast error" }), { status: 500, headers });
  }
};