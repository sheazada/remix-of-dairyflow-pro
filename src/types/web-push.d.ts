declare module "web-push" {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface RequestOptions {
    TTL?: number;
    headers?: Record<string, string>;
    timeout?: number;
    agent?: any;
    proxy?: string;
    gcmAPIKey?: string;
    vapidDetails?: {
      subject: string;
      privateKey: string;
      publicKey: string;
    };
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  }

  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(
    subscription: PushSubscription,
    data?: string,
    options?: RequestOptions,
  ): Promise<SendResult>;
  function generateVAPIDKeys(): { publicKey: string; privateKey: string };

  export {
    setVapidDetails,
    sendNotification,
    generateVAPIDKeys,
    PushSubscription,
    RequestOptions,
    SendResult,
  };
}
