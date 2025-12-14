import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for managing WebSocket connection and synchronization
 * Prevents infinite loops by tracking if we're applying a remote change
 */
export function useWebSocketSync(
  role,
  hostIp,
  onSyncEvent,
  onVideoIdSync = null
) {
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lastSyncAction, setLastSyncAction] = useState(null);
  const wsRef = useRef(null);
  const isApplyingRemoteChangeRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  // Store latest callbacks in refs to avoid stale closures
  const onSyncEventRef = useRef(onSyncEvent);
  const onVideoIdSyncRef = useRef(onVideoIdSync);
  useEffect(() => {
    onSyncEventRef.current = onSyncEvent;
    onVideoIdSyncRef.current = onVideoIdSync;
  }, [onSyncEvent, onVideoIdSync]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (!hostIp && role === "client") {
      return; // Can't connect without host IP
    }

    // Determine WebSocket URL
    let wsUrl;
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (role === "host") {
      if (isLocalhost) {
        // Local development: use localhost:8080
        wsUrl = "ws://localhost:8080";
      } else {
        // Remote hosting: use same origin with WebSocket protocol
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}`;
      }
    } else {
      // Client role
      if (hostIp) {
        // Use provided host IP
        const isRemoteHost =
          !hostIp.includes("localhost") && !hostIp.includes("127.0.0.1");
        if (isRemoteHost) {
          // Remote host: try to detect if we should use secure WebSocket
          const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
          // Use same port as current page, or default to 8080 for ws
          const port =
            window.location.port || (protocol === "wss:" ? "" : ":8080");
          wsUrl = `${protocol}//${hostIp}${port}`;
        } else {
          // Local IP provided
          wsUrl = `ws://${hostIp}:8080`;
        }
      } else {
        // No host IP provided, use current origin
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}`;
      }
    }

    console.log(`Connecting to ${wsUrl}...`);
    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const rawData = event.data;
          console.log("📨 [CLIENT] Raw WebSocket message received:", rawData);
          const data = JSON.parse(rawData);
          console.log("📨 [CLIENT] Parsed message:", data);

          // Handle connection confirmation
          if (data.type === "CONNECTED") {
            console.log("📨 [CLIENT]", data.message);
            return;
          }

          // Handle video ID sync
          if (data.type === "LOAD_VIDEO") {
            console.log("📥 [CLIENT] Received video ID sync message:", data);
            console.log("📥 [CLIENT] Video ID:", data.videoId);
            if (onVideoIdSyncRef.current) {
              console.log(
                "📥 [CLIENT] Calling onVideoIdSyncRef callback with:",
                data.videoId
              );
              try {
                onVideoIdSyncRef.current(data.videoId);
                console.log("📥 [CLIENT] Callback executed successfully");
              } catch (error) {
                console.error("📥 [CLIENT] Error in callback:", error);
              }
            } else {
              console.warn(
                "📥 [CLIENT] onVideoIdSyncRef callback is not defined!"
              );
            }
            return;
          }

          // Handle sync events (PLAY, PAUSE, SEEK)
          if (
            data.action &&
            (data.action === "PLAY" ||
              data.action === "PAUSE" ||
              data.action === "SEEK")
          ) {
            console.log("Received sync event:", data);
            // Mark that we're applying a remote change to prevent echo
            isApplyingRemoteChangeRef.current = true;

            setLastSyncAction({
              action: data.action,
              time: data.time,
              timestamp: data.timestamp || Date.now(),
            });

            // Call the callback to apply the sync event with server timestamp for latency compensation
            if (onSyncEventRef.current) {
              console.log("Calling onSyncEvent callback");
              onSyncEventRef.current(data.action, data.time, data.timestamp);
            } else {
              console.warn("onSyncEvent callback is not defined!");
            }

            // Reset the flag after a short delay
            setTimeout(() => {
              isApplyingRemoteChangeRef.current = false;
            }, 100);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionStatus("disconnected");

        // Auto-reconnect for clients (not hosts, as they control the server)
        if (role === "client" && hostIp) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionStatus("error");
    }
  }, [role, hostIp]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, []);

  /**
   * Send sync event to server
   * This prevents sending events that were received from the server
   * Allows both host and clients to send events (for client-side controls)
   */
  const sendSyncEvent = useCallback(
    (action, time) => {
      // Don't send if we're currently applying a remote change
      if (isApplyingRemoteChangeRef.current) {
        console.log("Not sending event: currently applying remote change");
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          action,
          time,
          timestamp: Date.now(),
        });
        wsRef.current.send(message);
        console.log(`Sent sync event: ${action} at ${time} (role: ${role})`);
      } else {
        console.warn("Cannot send sync event: WebSocket not open");
      }
    },
    [role]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    lastSyncAction,
    connect,
    disconnect,
    sendSyncEvent,
    isConnected: connectionStatus === "connected",
    wsRef, // Expose WebSocket ref for sending custom messages
  };
}
