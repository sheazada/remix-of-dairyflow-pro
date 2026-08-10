import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Search,
  ShoppingBag,
  Truck,
  Users,
  XCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/format";
import { sendPushToUser } from "@/lib/push-send.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const sendTestPushFn = useServerFn(sendPushToUser);

  const sendTestPush = async () => {
    setSendingTest(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        toast.error("Not logged in");
        return;
      }

      await sendTestPushFn({
        data: {
          userId: userRes.user.id,
          title: "🔔 Test Notification",
          body: "Push notifications are working! This is a test message.",
          type: "general",
        },
      });

      toast.success("Test push sent! Check your browser notifications.");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      console.error("Test push failed:", error);
      toast.error("Failed to send test push");
    } finally {
      setSendingTest(false);
    }
  };

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userRes.user.id)
        .order("created_at", { ascending: false });

      if (filter === "unread") {
        query = query.is("read_at", null);
      } else if (filter === "read") {
        query = query.not("read_at", "is", null);
      }

      const { data } = await query;
      return (data ?? []) as Notification[];
    },
  });

  const filtered = notifications.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const readCount = notifications.filter((n) => n.read_at).length;

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  };

  const markAllAsRead = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userRes.user.id)
      .is("read_at", null);

    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return ShoppingBag;
      case "delivery":
        return Truck;
      case "payment":
        return CheckCircle2;
      case "low_stock":
        return AlertCircle;
      case "expiry":
        return Clock;
      default:
        return Bell;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTestPush}
              disabled={sendingTest}
              className="gap-2"
            >
              <Send className="size-3" />
              {sendingTest ? "Sending..." : "Send Test Push"}
            </Button>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <div>
              <div className="text-2xl font-bold">{notifications.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-warning" />
            <div>
              <div className="text-2xl font-bold">{unreadCount}</div>
              <div className="text-xs text-muted-foreground">Unread</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <div>
              <div className="text-2xl font-bold">{readCount}</div>
              <div className="text-xs text-muted-foreground">Read</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "unread", "read"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 font-medium capitalize transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted"
              )}
            >
              {f} {f === "unread" && unreadCount > 0 && `(${unreadCount})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </Card>

      {/* Notifications List */}
      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {isLoading && (
            <div className="p-12 text-center text-muted-foreground">
              Loading notifications...
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center">
              <Inbox className="size-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <div className="text-sm font-medium">No notifications</div>
              <div className="text-xs text-muted-foreground mt-1">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "You'll be notified about important updates here"}
              </div>
            </div>
          )}

          {filtered.map((notification) => {
            const Icon = getIcon(notification.type);
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                className={cn(
                  "p-4 hover:bg-muted/30 transition-colors",
                  isUnread && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "size-10 rounded-full grid place-items-center shrink-0",
                      isUnread
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "font-medium text-sm",
                            isUnread && "text-foreground",
                            !isUnread && "text-muted-foreground"
                          )}
                        >
                          {notification.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.body}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {shortDate(notification.created_at)}
                      </div>
                    </div>
                    {isUnread && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(notification.id)}
                        className="mt-2 h-7 text-xs"
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}
