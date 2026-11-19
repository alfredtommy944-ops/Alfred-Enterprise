import webpush from "web-push";

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  const incomingKey = String(
    req.headers.get("x-owner-upload-key") || req.headers.get("x-profile-upload-key") || ""
  ).trim();
  const expectedKey = String(process.env.OWNER_UPLOAD_KEY || process.env.PROFILE_UPLOAD_KEY || "").trim();

  if (!expectedKey || incomingKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const keys = webpush.generateVAPIDKeys();
  return new Response(JSON.stringify(keys, null, 2), { status: 200, headers });
};
