// @ts-nocheck - Deno edge runtime has strict ArrayBuffer typing that doesn't match standard Web APIs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  message_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify JWT using anon client
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    const callerUserId = claimsData.claims.sub;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[send-dm-push] VAPID keys not configured, skipping");
      return new Response(
        JSON.stringify({ success: false, reason: "Push not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { message_id } = body as PushPayload;

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "message_id required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("[send-dm-push] Processing message:", message_id);

    // Get the message details
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      console.error("[send-dm-push] Message not found:", msgError);
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Verify the caller is the message sender
    if (message.sender_id !== callerUserId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: not the message sender" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get conversation participants (excluding sender)
    const { data: participants, error: partError } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .neq("user_id", message.sender_id);

    if (partError || !participants?.length) {
      console.log("[send-dm-push] No recipients found");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientIds = participants.map((p) => p.user_id);

    // Get sender's display name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", message.sender_id)
      .single();

    const senderName = senderProfile?.name || "Someone";

    // Get push subscriptions for recipients
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", recipientIds);

    if (subError || !subscriptions?.length) {
      console.log("[send-dm-push] No push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-dm-push] Found", subscriptions.length, "subscriptions to notify");

    // Truncate message preview
    const preview = message.content.length > 50 
      ? message.content.substring(0, 50) + "..." 
      : message.content;

    const notificationPayload = JSON.stringify({
      title: "New message",
      body: `${senderName}: ${preview}`,
      url: `/messages/${message.conversation_id}`,
      conversationId: message.conversation_id,
    });

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const response = await sendWebPushNotification(
            sub.endpoint,
            sub.p256dh,
            sub.auth,
            notificationPayload,
            vapidPublicKey,
            vapidPrivateKey,
            supabaseUrl
          );
          
          if (response === true) return true;
          if (response === "expired") return { invalid: true, endpoint: sub.endpoint };
          return false;
        } catch (error) {
          console.error("[send-dm-push] Push error for", sub.endpoint, error);
          return false;
        }
      })
    );

    // Clean up invalid subscriptions
    const invalidEndpoints = [];
    results.forEach((result) => {
      if (result.status === "fulfilled" && typeof result.value === "object" && result.value !== null && "invalid" in result.value) {
        invalidEndpoints.push(result.value.endpoint);
      }
    });

    if (invalidEndpoints.length > 0) {
      console.log("[send-dm-push] Cleaning up", invalidEndpoints.length, "invalid subscriptions");
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", invalidEndpoints);
    }

    const successCount = results.filter(r => r.status === "fulfilled" && r.value === true).length;
    console.log("[send-dm-push] Sent", successCount, "notifications");

    return new Response(
      JSON.stringify({ success: true, sent: successCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-dm-push] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Send a Web Push notification
async function sendWebPushNotification(
  endpoint,
  p256dh,
  auth,
  payload,
  vapidPublicKey,
  vapidPrivateKey,
  audience
) {
  try {
    // Create VAPID JWT
    const jwt = await createVapidJwt(endpoint, vapidPublicKey, vapidPrivateKey, audience);
    
    // Encrypt the payload
    const encrypted = await encryptPushPayload(payload, p256dh, auth);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }
    
    if (response.status === 404 || response.status === 410) {
      return "expired";
    }
    
    console.error("[sendWebPush] Failed:", response.status, await response.text());
    return false;
  } catch (e) {
    console.error("[sendWebPush] Error:", e);
    return false;
  }
}

// Create VAPID JWT for authorization
async function createVapidJwt(endpoint, publicKey, privateKey, audience) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  
  const header = { typ: "JWT", alg: "ES256" };
  const payloadObj = {
    aud,
    exp,
    sub: `mailto:noreply@${new URL(audience).hostname}`,
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payloadObj));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key and sign
  const privateKeyBytes = urlBase64ToBytes(privateKey);
  const publicKeyBytes = urlBase64ToBytes(publicKey);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64Url(publicKeyBytes.slice(1, 33)),
    y: bytesToBase64Url(publicKeyBytes.slice(33, 65)),
    d: bytesToBase64Url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signature = new Uint8Array(signatureBuffer);
  const rawSignature = signature.length === 64 ? signature : derToRaw(signature);
  const encodedSignature = bytesToBase64Url(rawSignature);
  
  return `${unsignedToken}.${encodedSignature}`;
}

// Encrypt payload for Web Push
async function encryptPushPayload(payload, p256dhKey, authSecret) {
  const subscriberPublicKey = standardBase64ToBytes(p256dhKey);
  const subscriberAuth = standardBase64ToBytes(authSecret);

  // Generate ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive keys using HKDF
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    subscriberPublicKey,
    localPublicKeyBytes
  );

  const prk = await hmacSha256(subscriberAuth, sharedSecret);
  const ikm = await hkdfExpand(prk, keyInfo, 32);
  
  const prk2 = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // Encrypt with AES-GCM
  const paddedPayload = concatBytes(
    new TextEncoder().encode(payload),
    new Uint8Array([2])
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload
  );

  // Build the message
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([localPublicKeyBytes.length]),
    localPublicKeyBytes,
    new Uint8Array(encrypted)
  );
}

// Helper: Base64URL encode a string
function base64UrlEncodeString(str) {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64Url(bytes);
}

// Helper: Bytes to Base64URL
function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Helper: URL Base64 to bytes
function urlBase64ToBytes(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Standard Base64 to bytes
function standardBase64ToBytes(base64String) {
  const rawData = atob(base64String);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Concatenate byte arrays
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Helper: HMAC-SHA256
async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

// Helper: HKDF Expand
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  let t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  let i = 1;

  while (okm.length < length) {
    const input = concatBytes(t, info, new Uint8Array([i]));
    const output = await crypto.subtle.sign("HMAC", key, input);
    t = new Uint8Array(output);
    okm = concatBytes(okm, t);
    i++;
  }

  return okm.slice(0, length);
}

// Helper: Convert DER signature to raw
function derToRaw(der) {
  const result = new Uint8Array(64);
  
  // Parse DER signature
  let offset = 2;
  const rLength = der[offset + 1];
  let rStart = offset + 2;
  if (der[rStart] === 0) rStart++;
  
  offset = offset + 2 + rLength;
  const sLength = der[offset + 1];
  let sStart = offset + 2;
  if (der[sStart] === 0) sStart++;
  
  const rBytes = der.slice(rStart, rStart + 32);
  const sBytes = der.slice(sStart, sStart + 32);
  
  result.set(rBytes, 0);
  result.set(sBytes, 32);
  
  return result;
}
