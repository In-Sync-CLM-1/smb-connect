// Shared Razorpay helpers for edge functions.
// Razorpay REST API: https://razorpay.com/docs/api/

import { encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}

export function getRazorpayCreds(): RazorpayCreds {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }
  return { keyId, keySecret };
}

function authHeader({ keyId, keySecret }: RazorpayCreds): string {
  return "Basic " + encodeBase64(`${keyId}:${keySecret}`);
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  created_at: number;
}

export async function createRazorpayOrder(
  creds: RazorpayCreds,
  params: {
    amountInPaise: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  },
): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      notes: params.notes,
      payment_capture: 1,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${txt}`);
  }
  return await res.json();
}

// HMAC-SHA256 hex digest. Used both for checkout signature verification and webhook verification.
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Verify Razorpay checkout success signature.
// Razorpay signs: order_id + "|" + payment_id with key_secret.
export async function verifyCheckoutSignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

// Verify Razorpay webhook signature (raw request body signed with webhook secret).
export async function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return safeEqual(expected, signature);
}
