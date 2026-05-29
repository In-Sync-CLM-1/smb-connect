// Razorpay Checkout loader and wrapper.
// Loads https://checkout.razorpay.com/v1/checkout.js once on demand
// and exposes a typed openCheckout() helper.

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
}

export interface RazorpayInstance {
  open(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  close(): void;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<void> {
  await loadRazorpayCheckout();
  if (!window.Razorpay) throw new Error("Razorpay SDK not available");
  const rzp = new window.Razorpay(options);
  rzp.open();
}
