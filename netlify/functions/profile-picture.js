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

    // GET: Load business profile picture
    if (event.httpMethod === "GET") {
      const data = await store.get("profile-picture", { type: "json" });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ picture: data && data.picture ? data.picture : "" })
      };
    }

    // PUT: Save new business profile picture (Owner only)
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
      if (!body.picture || typeof body.picture !== "string") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing picture data" })
        };
      }

      await store.setJSON("profile-picture", { picture: body.picture });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (err) {
    console.error("Profile picture function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error handling profile picture" })
    };
  }
};
