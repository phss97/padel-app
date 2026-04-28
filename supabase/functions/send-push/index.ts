// Supabase Edge Function: Send Web Push Notification
// Triggered by database webhooks on match_players changes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as webPush from "https://esm.sh/web-push@3.6.3";

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const { user_id, title, body, data = {} }:
      NotificationPayload = await req.json();

    // Get user's push subscription from profiles table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}&select=push_subscription_json`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const profiles = await profileRes.json();
    if (!profiles?.[0]?.push_subscription_json) {
      return new Response(JSON.stringify({ sent: false, reason: "no_subscription" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subscription = profiles[0].push_subscription_json;

    // Send push
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@padelmanager.com";

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    await webPush.sendNotification(
      subscription,
      JSON.stringify({ title, body, ...data })
    );

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ sent: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
