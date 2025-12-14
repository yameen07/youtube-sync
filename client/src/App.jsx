import { useState, useRef, useEffect, useCallback } from "react";
import YouTubePlayer from "./components/YouTubePlayer";
import { useWebSocketSync } from "./hooks/useWebSocketSync";

function App() {
  const [role, setRole] = useState(null); // 'host' or 'client'
  const [hostIp, setHostIp] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoIdInput, setVideoIdInput] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);
  const periodicSyncIntervalRef = useRef(null);

  /**
   * Handle sync events from WebSocket (for clients)
   * Use useCallback to ensure stable reference and access to latest values
   */
  const handleSyncEvent = useCallback(
    (action, time, serverTimestamp = null) => {
      console.log("handleSyncEvent called:", {
        action,
        time,
        serverTimestamp,
        role,
        hasPlayer: !!playerRef.current,
      });
      if (role === "client" && playerRef.current) {
        console.log("Calling syncPlayer on client");
        playerRef.current.syncPlayer(action, time, serverTimestamp);
        // Update playing state based on action
        if (action === "PLAY") {
          setIsPlaying(true);
        } else if (action === "PAUSE") {
          setIsPlaying(false);
        }
      } else {
        console.log("Sync event ignored:", {
          role,
          hasPlayer: !!playerRef.current,
        });
      }
    },
    [role]
  );

  /**
   * Handle video ID sync from other devices
   */
  const handleVideoIdSync = useCallback((videoId) => {
    console.log("🔗 [CLIENT] Received video ID sync, loading video:", videoId);
    if (!videoId) {
      console.warn("handleVideoIdSync called with invalid videoId");
      return;
    }
    // Update video ID and input - this will trigger the YouTube player to load
    console.log("🔗 [CLIENT] Setting videoId state to:", videoId);
    setVideoId(videoId);
    setVideoIdInput(videoId);
    setIsPlaying(false);
    console.log(
      "🔗 [CLIENT] Video ID set successfully, player should load:",
      videoId
    );
  }, []);

  // WebSocket sync hook
  const {
    connectionStatus,
    lastSyncAction,
    connect,
    disconnect,
    sendSyncEvent,
    isConnected,
    wsRef,
  } = useWebSocketSync(role, hostIp, handleSyncEvent, handleVideoIdSync);

  /**
   * Periodic time synchronization to prevent drift
   * Host sends current time every 3 seconds while playing
   */
  useEffect(() => {
    if (
      role === "host" &&
      isConnected &&
      isPlaying &&
      videoId &&
      playerRef.current?.isReady
    ) {
      periodicSyncIntervalRef.current = setInterval(() => {
        if (playerRef.current && playerRef.current.isReady) {
          try {
            const currentTime = playerRef.current.getCurrentTime();
            const playerState = playerRef.current.getPlayerState();

            // Only sync if video is actually playing (state 1 = PLAYING)
            if (playerState === 1) {
              sendSyncEvent("SEEK", currentTime);
            }
          } catch (error) {
            console.error("Error in periodic sync:", error);
          }
        }
      }, 3000); // Sync every 3 seconds

      return () => {
        if (periodicSyncIntervalRef.current) {
          clearInterval(periodicSyncIntervalRef.current);
          periodicSyncIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval if conditions not met
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
        periodicSyncIntervalRef.current = null;
      }
    }
  }, [role, isConnected, isPlaying, videoId, sendSyncEvent]);

  /**
   * Handle player state changes (for host)
   */
  function handlePlayerStateChange(action, time) {
    console.log("handlePlayerStateChange called:", {
      action,
      time,
      role,
      isConnected,
    });

    // Update playing state
    if (action === "PLAY") {
      setIsPlaying(true);
    } else if (action === "PAUSE") {
      setIsPlaying(false);
    }

    if (role === "host" && isConnected) {
      console.log("Host: Sending sync event:", action, time);
      sendSyncEvent(action, time);
    } else {
      console.log("Host: Not sending event (not host or not connected)");
    }
  }

  /**
   * Handle role selection
   */
  function selectRole(selectedRole) {
    if (role && connectionStatus === "connected") {
      disconnect();
    }
    setRole(selectedRole);
    setVideoId("");
    setVideoIdInput("");
  }

  /**
   * Connect to WebSocket
   */
  function handleConnect() {
    if (role === "client" && !hostIp.trim()) {
      alert("Please enter the host IP address");
      return;
    }
    connect();
  }

  /**
   * Extract video ID from text (URL or ID)
   */
  function extractVideoId(text) {
    if (!text || !text.trim()) return null;

    const trimmed = text.trim();

    // Try various YouTube URL patterns
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID (11 characters)
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Load video and sync to all devices
   */
  function handleLoadVideo(inputText = null) {
    const textToProcess = inputText || videoIdInput;

    if (!textToProcess.trim()) {
      alert("Please enter a YouTube video ID or URL");
      return;
    }

    // Extract video ID from URL or use as-is
    const extractedId = extractVideoId(textToProcess);

    if (!extractedId) {
      alert("Invalid YouTube video ID or URL");
      return;
    }

    // Load video locally
    setVideoId(extractedId);
    setVideoIdInput(extractedId); // Update input with clean ID
    setIsPlaying(false); // Reset playing state when loading new video

    // Sync video ID to all connected devices
    if (isConnected) {
      sendVideoIdSync(extractedId);
    }
  }

  /**
   * Handle paste event - auto-detect YouTube URLs
   */
  function handlePaste(e) {
    const pastedText = e.clipboardData.getData("text");
    const videoId = extractVideoId(pastedText);

    if (videoId) {
      e.preventDefault(); // Prevent default paste
      setVideoIdInput(videoId);
      // Auto-load after a short delay to ensure input is updated
      setTimeout(() => {
        handleLoadVideo(videoId);
      }, 50);
    }
  }

  /**
   * Send video ID sync to server
   */
  function sendVideoIdSync(videoId) {
    console.log("📤 [HOST] Attempting to send video ID sync:", videoId);
    console.log("📤 [HOST] WebSocket state:", {
      wsRef: !!wsRef,
      wsRefCurrent: !!wsRef?.current,
      readyState: wsRef?.current?.readyState,
      isConnected,
    });

    if (!wsRef?.current) {
      console.error("📤 [HOST] WebSocket ref not available");
      return;
    }

    if (wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: "LOAD_VIDEO",
        videoId: videoId,
        timestamp: Date.now(),
      });
      wsRef.current.send(message);
      console.log(`📤 [HOST] Sent video ID sync: ${videoId}`);
    } else {
      console.warn(
        "📤 [HOST] WebSocket not open, readyState:",
        wsRef.current.readyState
      );
    }
  }

  /**
   * Get local IP address helper (for host)
   */
  function getLocalIp() {
    // This is a helper message - actual IP detection would require additional setup
    return "Find your IP using: ifconfig (Mac/Linux) or ipconfig (Windows)";
  }

  /**
   * Handle play button click
   */
  function handlePlay() {
    if (!playerRef.current || !playerRef.current.isReady) {
      console.warn("Cannot play: player not ready");
      return;
    }

    // Mark as syncing to prevent echo
    const currentTime = playerRef.current.play();
    if (currentTime !== undefined && isConnected) {
      setIsPlaying(true);
      // Send sync event to server
      sendSyncEvent("PLAY", currentTime);
    }
  }

  /**
   * Handle pause button click
   */
  function handlePause() {
    if (!playerRef.current || !playerRef.current.isReady) {
      console.warn("Cannot pause: player not ready");
      return;
    }

    // Mark as syncing to prevent echo
    const currentTime = playerRef.current.pause();
    if (currentTime !== undefined && isConnected) {
      setIsPlaying(false);
      // Send sync event to server
      sendSyncEvent("PAUSE", currentTime);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>YouTube Sync</h1>
        <p className="subtitle">Synchronize YouTube playback across devices</p>
      </header>

      <main className="app-main">
        {/* Role Selection */}
        {!role && (
          <div className="role-selection">
            <h2>Select Your Role</h2>
            <div className="role-buttons">
              <button
                className="role-btn host-btn"
                onClick={() => selectRole("host")}
              >
                Host (Laptop)
              </button>
              <button
                className="role-btn client-btn"
                onClick={() => selectRole("client")}
              >
                Client (Mobile/Laptop)
              </button>
            </div>
          </div>
        )}

        {/* Host/Client Configuration */}
        {role && (
          <div className="configuration">
            <div className="role-display">
              <span className="role-badge">
                {role === "host" ? "Host" : "Client"}
              </span>
              <button
                className="change-role-btn"
                onClick={() => selectRole(null)}
              >
                Change Role
              </button>
            </div>

            {/* Client: Host IP Input */}
            {role === "client" && (
              <div className="input-group">
                <label htmlFor="host-ip">Host IP Address:</label>
                <input
                  id="host-ip"
                  type="text"
                  value={hostIp}
                  onChange={(e) => setHostIp(e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={isConnected}
                />
                {role === "host" && (
                  <small className="help-text">{getLocalIp()}</small>
                )}
              </div>
            )}

            {/* Host: Show connection info */}
            {role === "host" && (
              <div className="host-info">
                <p>
                  Start the WebSocket server, then connect clients to your local
                  IP.
                </p>
                <p className="info-text">Server: ws://localhost:8080</p>
              </div>
            )}

            {/* Connection Controls */}
            <div className="connection-controls">
              <button
                className={`connect-btn ${isConnected ? "connected" : ""}`}
                onClick={isConnected ? disconnect : handleConnect}
                disabled={role === "client" && !hostIp.trim()}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </button>
              <div className={`status-indicator ${connectionStatus}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {connectionStatus === "connected" && "Connected"}
                  {connectionStatus === "connecting" && "Connecting..."}
                  {connectionStatus === "disconnected" && "Disconnected"}
                  {connectionStatus === "error" && "Connection Error"}
                </span>
              </div>
            </div>

            {/* Last Sync Action Display */}
            {lastSyncAction && (
              <div className="sync-info">
                <p>
                  Last sync: <strong>{lastSyncAction.action}</strong> at{" "}
                  {lastSyncAction.time.toFixed(2)}s
                </p>
              </div>
            )}

            {/* Video Input */}
            {isConnected && (
              <div className="video-input">
                <div className="input-group">
                  <label htmlFor="video-id">YouTube Video ID or URL:</label>
                  <input
                    id="video-id"
                    type="text"
                    value={videoIdInput}
                    onChange={(e) => setVideoIdInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      // Auto-load on Enter key
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLoadVideo();
                      }
                    }}
                    placeholder="Paste YouTube URL or enter video ID (Enter to load)"
                  />
                  <button className="load-video-btn" onClick={handleLoadVideo}>
                    Load Video
                  </button>
                  {extractVideoId(videoIdInput) && (
                    <small
                      className="help-text"
                      style={{
                        color: "#48bb78",
                        display: "block",
                        marginTop: "5px",
                      }}
                    >
                      ✓ YouTube URL detected - Press Enter or click Load Video
                    </small>
                  )}
                </div>
              </div>
            )}

            {/* YouTube Player */}
            {videoId && (
              <div className="player-section">
                <YouTubePlayer
                  ref={playerRef}
                  videoId={videoId}
                  role={role}
                  onPlayerStateChange={handlePlayerStateChange}
                />
                {/* Play/Pause Controls - Show for clients (or both if you want) */}
                {role === "client" && isConnected && (
                  <div className="player-controls">
                    <button
                      className="play-pause-btn"
                      onClick={isPlaying ? handlePause : handlePlay}
                      disabled={!playerRef.current?.isReady}
                    >
                      {isPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Make sure all devices are on the same Wi-Fi network</p>
      </footer>
    </div>
  );
}

export default App;
