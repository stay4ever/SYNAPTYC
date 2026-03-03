/**
 * src/ws.js — Phoenix WebSocket manager for SYNAPTYC
 *
 * Features:
 *   • vsn 1.0.0 JSON object protocol (compatible with all Phoenix versions)
 *   • Persistent topic subscriptions (survive reconnects)
 *   • Heartbeat with timeout detection (kills zombie connections)
 *   • Exponential backoff reconnect (1s → 30s cap)
 *   • Token refresh on reconnect (handles JWT expiry)
 *   • Connection status callback for UI banner
 */
'use strict';

const HEARTBEAT_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 35000;

class PhoenixWS {
  /**
   * @param {Object} opts
   * @param {string}   opts.url            WebSocket base URL (without query params)
   * @param {string}   opts.token          Current JWT
   * @param {function} opts.onMessage      (frame) => void — app-level messages
   * @param {function} opts.onStatusChange (status) => void — 'connecting'|'connected'|'disconnected'
   * @param {function} [opts.onError]      (reason) => void — server error replies
   */
  constructor({ url, token, onMessage, onStatusChange, onError }) {
    this._baseUrl = url;
    this._token = token;
    this._onMessage = onMessage;
    this._onStatusChange = onStatusChange || (() => {});
    this._onError = onError || (() => {});

    this._ws = null;
    this._status = 'disconnected';
    this._joinedTopics = new Set();
    this._ref = 0;
    this._pendingHeartbeatRef = null;

    this._heartbeatTimer = null;
    this._heartbeatTimeoutTimer = null;
    this._reconnectTimer = null;
    this._backoff = 1000;
    this._destroyed = false;
  }

  /** Update the token (e.g., after a refresh). Next (re)connect will use it. */
  setToken(t) { this._token = t; }

  /** Connect (or reconnect) to the server. */
  connect() {
    if (this._destroyed) return;
    this._clearTimers();
    this._setStatus('connecting');

    // Build URL fresh each time so token is never stale
    const url = `${this._baseUrl}?token=${encodeURIComponent(this._token)}&vsn=1.0.0`;
    const ws = new WebSocket(url);
    this._ws = ws;

    ws.onopen = () => {
      if (this._destroyed) { ws.close(); return; }
      this._backoff = 1000;
      this._setStatus('connected');
      this._startHeartbeat();
      // Re-join all remembered topics
      for (const topic of this._joinedTopics) {
        this._rawSend(topic, 'phx_join', {});
      }
    };

    ws.onmessage = (evt) => {
      try {
        const frame = JSON.parse(evt.data);
        if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return;
        const { event, payload, ref } = frame;
        if (!event) return;

        // Heartbeat reply — clear timeout
        if (event === 'phx_reply' && ref === this._pendingHeartbeatRef) {
          this._pendingHeartbeatRef = null;
          if (this._heartbeatTimeoutTimer) {
            clearTimeout(this._heartbeatTimeoutTimer);
            this._heartbeatTimeoutTimer = null;
          }
          return;
        }

        // Server error replies
        if (event === 'phx_reply' && payload?.status === 'error') {
          this._onError(payload?.response?.reason || 'Server error');
          return;
        }

        // Skip remaining Phoenix control frames
        if (event === 'phx_reply' || event === 'phx_error' || event === 'phx_close') return;

        // Dispatch app-level messages
        this._onMessage(frame);
      } catch (_) {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      this._clearTimers();
      if (this._destroyed) return;
      this._setStatus('disconnected');
      const delay = Math.min(this._backoff, 30000);
      // Add random jitter (0–1s) to prevent thundering herd on server recovery
      const jitter = Math.floor(Math.random() * 1000);
      this._backoff = Math.min(this._backoff * 2, 30000);
      this._reconnectTimer = setTimeout(() => this.connect(), delay + jitter);
    };
  }

  /** Send a Phoenix channel frame. Safe when disconnected (silently drops). */
  send(topic, event, payload) {
    this._rawSend(topic, event, payload);
  }

  /** Join a topic. Idempotent — remembers for auto-rejoin on reconnect. */
  join(topic) {
    this._joinedTopics.add(topic);
    if (this._status === 'connected') {
      this._rawSend(topic, 'phx_join', {});
    }
  }

  /** Leave a topic and forget it. */
  leave(topic) {
    this._joinedTopics.delete(topic);
    if (this._status === 'connected') {
      this._rawSend(topic, 'phx_leave', {});
    }
  }

  /** Current connection status. */
  getStatus() { return this._status; }

  /** Tear down — stop reconnecting, close WS. */
  destroy() {
    this._destroyed = true;
    this._clearTimers();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
    this._setStatus('disconnected');
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _rawSend(topic, event, payload) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ref += 1;
      const ref = String(this._ref);
      this._ws.send(JSON.stringify({ topic, event, payload: payload ?? {}, ref }));
      return ref;
    }
    return null;
  }

  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      // If a previous heartbeat is still pending, the connection is dead
      if (this._pendingHeartbeatRef !== null) {
        this._abnormalClose('heartbeat timeout');
        return;
      }
      this._pendingHeartbeatRef = this._rawSend('phoenix', 'heartbeat', {});
      // Safety timeout — if reply doesn't arrive within 5s, force close
      this._heartbeatTimeoutTimer = setTimeout(() => {
        if (this._pendingHeartbeatRef !== null) {
          this._abnormalClose('heartbeat timeout');
        }
      }, HEARTBEAT_TIMEOUT_MS - HEARTBEAT_MS);
    }, HEARTBEAT_MS);
  }

  _abnormalClose(reason) {
    this._pendingHeartbeatRef = null;
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
    this._clearTimers();
    if (this._destroyed) return;
    this._setStatus('disconnected');
    // Reconnect after a short delay (not full backoff — this was an active connection)
    this._reconnectTimer = setTimeout(() => this.connect(), 1000);
  }

  _clearTimers() {
    if (this._heartbeatTimer)        { clearInterval(this._heartbeatTimer);       this._heartbeatTimer = null; }
    if (this._heartbeatTimeoutTimer) { clearTimeout(this._heartbeatTimeoutTimer); this._heartbeatTimeoutTimer = null; }
    if (this._reconnectTimer)        { clearTimeout(this._reconnectTimer);        this._reconnectTimer = null; }
    this._pendingHeartbeatRef = null;
  }

  _setStatus(s) {
    if (this._status !== s) {
      this._status = s;
      this._onStatusChange(s);
    }
  }
}

module.exports = { PhoenixWS };
