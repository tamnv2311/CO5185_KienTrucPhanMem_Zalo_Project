/**
 * A small STOMP 1.2 client over a plain WebSocket: CONNECT, SUBSCRIBE, SEND, heart-beats and
 * automatic reconnect. It covers what the chat service needs and has no dependencies, which
 * keeps it working on every React Native runtime.
 */

export interface StompOptions {
  url: () => string;
  /** Headers of the CONNECT frame (the access token goes here). */
  connectHeaders: () => Record<string, string>;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Called before a retry that follows a refused connection, e.g. to renew an expired token. */
  beforeRetry?: () => Promise<unknown>;
  reconnectDelayMs?: number;
}

export interface Subscription {
  unsubscribe(): void;
}

type Listener = (body: string) => void;

export class StompClient {
  private socket?: WebSocket;
  private active = false;
  private isConnected = false;
  private refused = false;
  private nextId = 0;
  private listeners = new Map<string, { destination: string; listener: Listener }>();
  private retryTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;

  constructor(private options: StompOptions) {}

  get connected(): boolean {
    return this.isConnected;
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.open();
  }

  deactivate() {
    this.active = false;
    clearTimeout(this.retryTimer);
    this.listeners.clear();
    this.close();
  }

  /** Drops a connection that may be dead (the app was in the background) and opens a new one. */
  reconnectNow() {
    if (!this.active) return;
    clearTimeout(this.retryTimer);
    this.close();
    this.open();
  }

  subscribe(destination: string, listener: Listener): Subscription {
    const id = `sub-${this.nextId++}`;
    this.listeners.set(id, { destination, listener });
    if (this.isConnected) this.send("SUBSCRIBE", { id, destination });
    return {
      unsubscribe: () => {
        if (this.listeners.delete(id) && this.isConnected) this.send("UNSUBSCRIBE", { id });
      },
    };
  }

  publish(destination: string, body: string) {
    if (this.isConnected) this.send("SEND", { destination, "content-type": "application/json" }, body);
  }

  private open() {
    const socket = new WebSocket(this.options.url());
    this.socket = socket;
    socket.onopen = () => {
      this.send("CONNECT", { "accept-version": "1.2,1.1", "heart-beat": "15000,0", ...this.options.connectHeaders() });
    };
    socket.onmessage = event => {
      if (socket !== this.socket || typeof event.data !== "string") return;
      for (const raw of event.data.split("\0")) this.receive(raw);
    };
    socket.onerror = () => undefined; // onclose follows and handles the retry
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = undefined;
      this.dropped();
    };
  }

  /** Closes on purpose: no retry is scheduled. */
  private close() {
    const socket = this.socket;
    this.socket = undefined;
    clearInterval(this.pingTimer);
    const wasConnected = this.isConnected;
    this.isConnected = false;
    try { socket?.close(); } catch { /* already closed */ }
    if (wasConnected) this.options.onDisconnect();
  }

  /** The connection was lost or refused: retry after a pause. */
  private dropped() {
    clearInterval(this.pingTimer);
    const wasConnected = this.isConnected;
    this.isConnected = false;
    if (wasConnected) this.options.onDisconnect();
    else this.refused = true;
    if (!this.active) return;
    this.retryTimer = setTimeout(async () => {
      if (this.refused && this.options.beforeRetry) {
        try { await this.options.beforeRetry(); } catch { /* retry anyway */ }
      }
      if (this.active && !this.socket) this.open();
    }, this.options.reconnectDelayMs ?? 3000);
  }

  private receive(raw: string) {
    const frame = raw.replace(/^[\r\n]+/, ""); // leading line breaks are heart-beats
    if (!frame) return;
    const split = frame.indexOf("\n\n");
    const head = (split < 0 ? frame : frame.slice(0, split)).split("\n");
    const body = split < 0 ? "" : frame.slice(split + 2);
    const command = head[0].trim();
    const headers: Record<string, string> = {};
    for (const line of head.slice(1)) {
      const colon = line.indexOf(":");
      if (colon > 0 && !(line.slice(0, colon) in headers)) headers[line.slice(0, colon)] = line.slice(colon + 1).trim();
    }

    if (command === "CONNECTED") {
      this.isConnected = true;
      this.refused = false;
      // "sx,sy": sy is how often the server wants to hear from us (0 = never).
      const wanted = Number((headers["heart-beat"] ?? "0,0").split(",")[1] ?? 0);
      if (wanted > 0) this.pingTimer = setInterval(() => this.raw("\n"), Math.max(wanted, 15000));
      for (const [id, { destination }] of this.listeners) this.send("SUBSCRIBE", { id, destination });
      this.options.onConnect();
    } else if (command === "MESSAGE") {
      this.listeners.get(headers.subscription)?.listener(body);
    } else if (command === "ERROR") {
      this.refused = true;
      try { this.socket?.close(); } catch { /* onclose handles the rest */ }
    }
  }

  private send(command: string, headers: Record<string, string>, body = "") {
    const head = Object.entries(headers).map(([key, value]) => `${key}:${value}`).join("\n");
    this.raw(`${command}\n${head}\n\n${body}\0`);
  }

  private raw(data: string) {
    try { this.socket?.send(data); } catch { /* the socket is closing; onclose reconnects */ }
  }
}
