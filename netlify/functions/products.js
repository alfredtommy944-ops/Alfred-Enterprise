const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-profile-upload-key",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const store = getStore("alfred-enterprise-store");

    // GET: Load all products for customers
    if (event.httpMethod === "GET") {
      const data = await store.get("products", { type: "json" });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ products: data && Array.isArray(data.products) ? data.products : [] })
      };
    }

    // PUT: Save updated products list (Owner only)
    if (event.httpMethod === "PUT") {
      const incomingKey =
        event.headers["x-profile-upload-key"] ||
        event.headers["X-Profile-Upload-Key"] ||
        "";
      const expectedKey = process.env.OWNER_UPLOAD_KEY || process.env.PROFILE_UPLOAD_KEY;

      if (!expectedKey || incomingKey !== expectedKey) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Unauthorized: Invalid Owner Login Code" })
        };
      }

      const body = JSON.parse(event.body || "{}");
      if (!Array.isArray(body.products)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid products payload" })
        };
      }

      await store.setJSON("products", { products: body.products });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, count: body.products.length })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (err) {
    console.error("Products function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error handling products" })
    };
  }
};
