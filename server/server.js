const WebSocket = require("ws");
const http = require("http");

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store all connected clients
const clients = new Set();

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from ${clientIp}`);
  clients.add(ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      message: "Connected to YouTube sync server",
    })
  );

  // Handle incoming messages from clients
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle video ID sync
      if (data.type === "LOAD_VIDEO") {
        console.log(`📡 [SERVER] Broadcasting video ID: ${data.videoId}`);
        console.log(`📡 [SERVER] Total clients: ${clients.size}`);

        let broadcastCount = 0;
        // Broadcast to all clients except the sender
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
              type: "LOAD_VIDEO",
              videoId: data.videoId,
              timestamp: Date.now(),
            });
            client.send(message);
            broadcastCount++;
            console.log(
              `📡 [SERVER] Sent video ID to client (${broadcastCount})`
            );
          } else {
            console.log(
              `📡 [SERVER] Skipping client (same as sender or not open)`
            );
          }
        });
        console.log(`📡 [SERVER] Broadcasted to ${broadcastCount} client(s)`);
        return;
      }

      // Handle playback control commands
      // Broadcast to all other clients (excluding sender)
      if (
        data.action &&
        (data.action === "PLAY" ||
          data.action === "PAUSE" ||
          data.action === "SEEK")
      ) {
        console.log(`Broadcasting ${data.action} at time ${data.time}`);

        // Broadcast to all clients except the sender
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                action: data.action,
                time: data.time,
                timestamp: Date.now(),
              })
            );
          }
        });
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    console.log(`Client disconnected from ${clientIp}`);
    clients.delete(ws);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws);
  });
});

// Start server
const PORT = 8080;
const HOST = "0.0.0.0"; // Listen on all interfaces to accept connections from other devices
server.listen(PORT, HOST, () => {
  console.log(`YouTube Sync WebSocket server running on port ${PORT}`);
  console.log(`Connect clients to: ws://YOUR_LOCAL_IP:${PORT}`);
  console.log(
    `To find your local IP, run: ifconfig (Mac/Linux) or ipconfig (Windows)`
  );
});
