// Notification Manager Component
// Handles notification permission, subscription management, and unread badge

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, AlertCircle } from "lucide-react";
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  initializeNotifications,
  getPushSubscription,
  unsubscribeFromPush,
} from "@/lib/browser-notifications";
import { getUnreadNotificationCount } from "@/lib/push-send.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

export function NotificationManager({ className }: { className?: string }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const navigate = useNavigate();

  // Fetch unread count from database
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchUnread = useServerFn(getUnreadNotificationCount);
  const { data: unreadData } = useQuery({
    queryKey: ["unread-notification-count"],
    enabled: signedIn,
    retry: false,
    queryFn: async () => {
      try {
        const result = await fetchUnread({ data: undefined });
        return result as { count: number };
      } catch {
        return { count: 0 };
      }
    },
    refetchInterval: 30_000, // Poll every 30 seconds
    staleTime: 15_000,
  });

  const unreadCount = (unreadData as { count: number } | undefined)?.count ?? 0;

  useEffect(() => {
    setSupported(isPushSupported());
    
    if (isPushSupported()) {
      initializeNotifications().then(() => {
        checkSubscriptionStatus();
      });
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    const subscription = await getPushSubscription();
    setIsSubscribed(!!subscription);
  };

  const handleEnable = async () => {
    if (!supported) {
      toast.error("Your browser doesn't support push notifications");
      return;
    }

    setLoading(true);

    try {
      const granted = await requestNotificationPermission();
      
      if (granted) {
        setPermission("granted");
        await initializeNotifications();
        await checkSubscriptionStatus();
      } else {
        setPermission("denied");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);

    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      toast.success("Notifications disabled");
    } catch (error) {
      console.error("Error disabling notifications:", error);
      toast.error("Failed to disable notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    navigate({ to: "/notifications" });
  };

  if (!supported) {
    return null; // Hide entirely if not supported, rather than showing an error
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {permission === "granted" && isSubscribed ? (
        <button
          onClick={handleBellClick}
          className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
          title={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        >
          <BellRing className="size-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : permission === "granted" ? (
        <button
          onClick={handleBellClick}
          className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <Bell className="size-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : permission === "denied" ? (
        <button
          onClick={handleEnable}
          className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Notifications blocked — click to enable"
        >
          <BellOff className="size-4 text-muted-foreground" />
        </button>
      ) : (
        <button
          onClick={handleEnable}
          disabled={loading}
          className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Enable notifications"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Bell className="size-4 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}
