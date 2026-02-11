import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// VAPID public key - will be fetched from Edge Function
let cachedVapidKey: string | null = null;

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | "unsupported";
  error: string | null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: "unsupported",
    error: null,
  });

  // Check if push is supported
  const checkSupport = useCallback(() => {
    const supported = 
      "serviceWorker" in navigator && 
      "PushManager" in window && 
      "Notification" in window;
    
    return supported;
  }, []);

  // Fetch VAPID public key from Edge Function
  const getVapidKey = useCallback(async (): Promise<string | null> => {
    if (cachedVapidKey) return cachedVapidKey;

    try {
      const { data, error } = await supabase.functions.invoke("get-vapid-key", {
        method: "GET",
      });

      if (error || !data?.vapidKey) {
        console.log("[Push] VAPID key not configured, push disabled");
        return null;
      }

      cachedVapidKey = data.vapidKey;
      return cachedVapidKey;
    } catch (e) {
      console.log("[Push] Failed to fetch VAPID key:", e);
      return null;
    }
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!checkSupport() || !user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      // Also check if subscription exists in database
      let dbSubscribed = false;
      if (subscription) {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();
        
        dbSubscribed = !!data;
      }

      setState(prev => ({
        ...prev,
        isSupported: true,
        isSubscribed: !!subscription && dbSubscribed,
        permission: Notification.permission,
        isLoading: false,
      }));
    } catch (e) {
      console.error("[Push] Check subscription error:", e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to check subscription status",
      }));
    }
  }, [user, checkSupport]);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!checkSupport()) return null;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("[Push] Service worker registered");
      return registration;
    } catch (e) {
      console.error("[Push] SW registration failed:", e);
      return null;
    }
  }, [checkSupport]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: "Must be logged in" }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== "granted") {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Notification permission denied",
        }));
        return false;
      }

      // Get VAPID key
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Push notifications not configured",
        }));
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Failed to register service worker",
        }));
        return false;
      }

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      console.log("[Push] Subscribed:", subscription);

      // Save to database
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!p256dh || !auth) {
        throw new Error("Missing encryption keys");
      }

      const { error: dbError } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
          user_agent: navigator.userAgent,
        }, {
          onConflict: "endpoint",
        });

      if (dbError) throw dbError;

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (e) {
      console.error("[Push] Subscribe error:", e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : "Failed to subscribe",
      }));
      return false;
    }
  }, [user, getVapidKey, registerServiceWorker]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        // Remove from database first
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        // Then unsubscribe
        await subscription.unsubscribe();
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (e) {
      console.error("[Push] Unsubscribe error:", e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to unsubscribe",
      }));
      return false;
    }
  }, [user]);

  // Initial setup
  useEffect(() => {
    const isSupported = checkSupport();
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : "unsupported",
    }));

    if (isSupported && user) {
      registerServiceWorker().then(() => checkSubscription());
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user, checkSupport, registerServiceWorker, checkSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// Helper: Convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
