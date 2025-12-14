import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";

/**
 * YouTubePlayer Component
 * Integrates YouTube IFrame Player API and handles playback synchronization
 */
const YouTubePlayer = forwardRef(function YouTubePlayer(
  { videoId, role, onPlayerStateChange },
  ref
) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const isSyncingRef = useRef(false);

  // Store latest callback in ref to avoid stale closures
  const onPlayerStateChangeRef = useRef(onPlayerStateChange);
  useEffect(() => {
    onPlayerStateChangeRef.current = onPlayerStateChange;
  }, [onPlayerStateChange]);

  /**
   * Handle YouTube player state changes
   * States: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
   */
  const handlePlayerStateChange = useRef((event) => {
    const state = event.data;
    const player = event.target;

    console.log(
      "Player state changed:",
      state,
      "isSyncing:",
      isSyncingRef.current
    );

    // Only emit events for play/pause (not buffering, etc.)
    if (state === window.YT.PlayerState.PLAYING) {
      if (!isSyncingRef.current && onPlayerStateChangeRef.current) {
        const currentTime = player.getCurrentTime();
        console.log("Host: Emitting PLAY event at", currentTime);
        onPlayerStateChangeRef.current("PLAY", currentTime);
      } else {
        console.log("Host: Ignoring PLAY event (syncing or no callback)");
      }
    } else if (state === window.YT.PlayerState.PAUSED) {
      if (!isSyncingRef.current && onPlayerStateChangeRef.current) {
        const currentTime = player.getCurrentTime();
        console.log("Host: Emitting PAUSE event at", currentTime);
        onPlayerStateChangeRef.current("PAUSE", currentTime);
      } else {
        console.log("Host: Ignoring PAUSE event (syncing or no callback)");
      }
    }
  });

  // Store videoId in ref to access latest value in initializePlayer
  const videoIdRef = useRef(videoId);
  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  /**
   * Initialize YouTube player
   */
  const initializePlayer = useRef(() => {
    if (!containerRef.current) return;

    try {
      const currentVideoId = videoIdRef.current || "";
      console.log("Initializing player with videoId:", currentVideoId);
      const player = new window.YT.Player(containerRef.current, {
        height: "360",
        width: "100%",
        videoId: currentVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            console.log(
              "YouTube player ready, current videoId:",
              videoIdRef.current
            );
            setIsReady(true);
            playerRef.current = event.target;
            // If videoId was set before player was ready, load it now
            if (videoIdRef.current) {
              console.log("Loading video on ready:", videoIdRef.current);
              try {
                playerRef.current.loadVideoById(videoIdRef.current);
              } catch (error) {
                console.error("Error loading video on ready:", error);
              }
            }
          },
          onStateChange: (event) => {
            handlePlayerStateChange.current(event);
          },
        },
      });
    } catch (error) {
      console.error("Error initializing YouTube player:", error);
    }
  });

  // Load YouTube IFrame API
  useEffect(() => {
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      initializePlayer.current();
      return;
    }

    // Load the API script
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Set callback for when API is ready
    window.onYouTubeIframeAPIReady = () => {
      initializePlayer.current();
    };

    return () => {
      // Cleanup: destroy player on unmount
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error("Error destroying player:", error);
        }
      }
    };
  }, []);

  // Reinitialize player when videoId changes
  useEffect(() => {
    if (videoId) {
      if (isReady && playerRef.current) {
        console.log("Loading video by ID:", videoId);
        try {
          playerRef.current.loadVideoById(videoId);
        } catch (error) {
          console.error("Error loading video:", error);
        }
      } else {
        console.log(
          "Player not ready yet, videoId will load when ready:",
          videoId
        );
      }
    }
  }, [videoId, isReady]);

  /**
   * Sync player to remote state
   * Called from parent when receiving WebSocket messages
   * Optimized for low latency
   */
  const syncPlayer = (action, time, serverTimestamp = null) => {
    console.log("syncPlayer called:", {
      action,
      time,
      isReady,
      hasPlayer: !!playerRef.current,
      serverTimestamp,
    });

    if (!playerRef.current) {
      console.warn("Cannot sync: player not initialized");
      return;
    }

    if (!isReady) {
      console.warn("Cannot sync: player not ready");
      return;
    }

    isSyncingRef.current = true;

    // Calculate latency compensation if server timestamp is provided
    let compensatedTime = time;
    if (serverTimestamp) {
      const networkLatency = (Date.now() - serverTimestamp) / 1000; // Convert to seconds
      compensatedTime = time + networkLatency;
      console.log(
        `Network latency: ${networkLatency.toFixed(
          3
        )}s, compensated time: ${compensatedTime.toFixed(3)}s`
      );
    }

    try {
      const currentTime = playerRef.current.getCurrentTime();
      const timeDiff = Math.abs(compensatedTime - currentTime);

      // Only seek if time difference is significant (>0.2s for SEEK, >0.1s for PLAY/PAUSE)
      // This prevents micro-seeks that can cause stuttering
      const seekThreshold = action === "SEEK" ? 0.4 : 0.1;

      if (timeDiff > seekThreshold) {
        playerRef.current.seekTo(compensatedTime, true);
      }

      // Execute play/pause immediately without delay for lower latency
      // Use microtask queue for immediate execution
      if (action === "PLAY") {
        // Execute immediately, YouTube API handles the async nature
        playerRef.current.playVideo();
      } else if (action === "PAUSE") {
        playerRef.current.pauseVideo();
      } else if (action === "SEEK") {
        // Seek already handled above, but ensure we're at the right time
        if (timeDiff <= seekThreshold) {
          // Time is close enough, no seek needed
          console.log(
            `Time difference ${timeDiff.toFixed(
              3
            )}s is within threshold, skipping seek`
          );
        }
      }

      console.log(
        `Successfully synced: ${action} at ${compensatedTime.toFixed(
          3
        )}s (diff: ${timeDiff.toFixed(3)}s)`
      );
    } catch (error) {
      console.error("Error syncing player:", error);
    }

    // Reset sync flag after shorter delay for faster response
    // Reduced from 500ms to 150ms for better responsiveness
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 150);
  };

  /**
   * Play the video
   */
  const play = () => {
    if (!playerRef.current || !isReady) {
      console.warn("Cannot play: player not ready");
      return;
    }
    try {
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.playVideo();
      console.log("Playing video at", currentTime);
      return currentTime;
    } catch (error) {
      console.error("Error playing video:", error);
    }
  };

  /**
   * Pause the video
   */
  const pause = () => {
    if (!playerRef.current || !isReady) {
      console.warn("Cannot pause: player not ready");
      return;
    }
    try {
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.pauseVideo();
      console.log("Pausing video at", currentTime);
      return currentTime;
    } catch (error) {
      console.error("Error pausing video:", error);
    }
  };

  /**
   * Get current playback time
   */
  const getCurrentTime = () => {
    return playerRef.current?.getCurrentTime() || 0;
  };

  /**
   * Get player state
   */
  const getPlayerState = () => {
    if (!playerRef.current) return -1;
    try {
      return playerRef.current.getPlayerState();
    } catch (error) {
      return -1;
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      syncPlayer,
      play,
      pause,
      getCurrentTime,
      getPlayerState,
      isReady: isReady,
    }),
    [isReady]
  );

  return (
    <div className="youtube-player-container">
      <div ref={containerRef} id="youtube-player"></div>
      {!isReady && (
        <div className="player-loading">Loading YouTube player...</div>
      )}
    </div>
  );
});

export default YouTubePlayer;
