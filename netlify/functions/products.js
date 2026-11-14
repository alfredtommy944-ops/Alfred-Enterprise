import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-profile-upload-key, x-owner-upload-key",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  try {
    const store = getStore("alfred-enterprise-store");

    // GET: Load all products for customers
    if (req.method === "GET") {
      const data = await store.get("products", { type: "json" });
      return new Response(
        JSON.stringify({
          products: data && Array.isArray(data.products) ? data.products : []
        }),
        { status: 200, headers }
      );
    }

    // PUT: Save updated products list (Owner only)
    if (req.method === "PUT") {
      const rawIncoming =
        req.headers.get("x-profile-upload-key") ||
        req.headers.get("x-owner-upload-key") ||
        "";

      const rawExpected =
        process.env.OWNER_UPLOAD_KEY ||
        process.env.PROFILE_UPLOAD_KEY ||
        "";

      const incomingKey = String(rawIncoming).trim();
      const expectedKey = String(rawExpected).trim();

      if (!expectedKey || incomingKey !== expectedKey) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid Owner Login Code" }),
          { status: 401, headers }
        );
      }

      const body = await req.json();
      if (!body || !Array.isArray(body.products)) {
        return new Response(
          JSON.stringify({ error: "Invalid products payload" }),
          { status: 400, headers }
        );
      }

      await store.setJSON("products", { products: body.products });
      return new Response(
        JSON.stringify({ ok: true, count: body.products.length }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers }
    );
  } catch (err) {
    console.error("Products function error:", err);
    return new Response(
      JSON.stringify({
        error: err && err.message ? err.message : "Server error handling products"
      }),
      { status: 500, headers }
    );
  }
};
