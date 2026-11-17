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

    // GET: Load saved profile picture
    if (req.method === "GET") {
      const data = await store.get("profile-picture", { type: "json" });
      const savedImg =
        data && typeof data.image === "string" && data.image
          ? data.image
          : data && typeof data.picture === "string" && data.picture
          ? data.picture
          : "";

      return new Response(
        JSON.stringify({ image: savedImg, picture: savedImg }),
        { status: 200, headers }
      );
    }

    // PUT: Save new profile picture (Owner only)
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
      const incomingImage =
        body && typeof body.image === "string" && body.image
          ? body.image
          : body && typeof body.picture === "string" && body.picture
          ? body.picture
          : "";

      if (!incomingImage) {
        return new Response(
          JSON.stringify({ error: "Invalid picture payload" }),
          { status: 400, headers }
        );
      }

      await store.setJSON("profile-picture", {
        image: incomingImage,
        picture: incomingImage
      });

      return new Response(
        JSON.stringify({ ok: true, image: incomingImage, picture: incomingImage }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers }
    );
  } catch (err) {
    console.error("Profile picture function error:", err);
    return new Response(
      JSON.stringify({
        error: err && err.message ? err.message : "Server error handling profile picture"
      }),
      { status: 500, headers }
    );
  }
};
