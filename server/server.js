const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Get port from environment variable or use default
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

// Path to built client files
const CLIENT_BUILD_PATH = path.join(__dirname, "../client/dist");

// Check if client build exists
if (!fs.existsSync(CLIENT_BUILD_PATH)) {
  console.warn(`⚠️  Warning: Client build not found at ${CLIENT_BUILD_PATH}`);
  console.warn("   Run 'cd client && npm run build' to build the client");
  console.warn(
    "   Server will still run for WebSocket connections, but web UI won't be available"
  );
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Skip file serving for WebSocket upgrade requests (handled by WebSocket server)
  if (req.headers.upgrade === "websocket") {
    // Let the WebSocket server handle this
    return;
  }

  // If client build doesn't exist, return helpful message
  if (!fs.existsSync(CLIENT_BUILD_PATH)) {
    res.writeHead(503, { "Content-Type": "text/html" });
    res.end(`
      <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>Client Build Not Found</h1>
          <p>Please build the client first:</p>
          <pre style="background: #f5f5f5; padding: 20px; display: inline-block; border-radius: 5px;">
cd client && npm install && npm run build
          </pre>
        </body>
      </html>
    `);
    return;
  }

  // Serve static files from client build
  let filePath = path.join(
    CLIENT_BUILD_PATH,
    req.url === "/" ? "index.html" : req.url
  );

  // Security: prevent directory traversal
  if (!filePath.startsWith(CLIENT_BUILD_PATH)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file doesn't exist, serve index.html (for React Router)
      filePath = path.join(CLIENT_BUILD_PATH, "index.html");
    }

    // Read and serve the file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("File not found");
        return;
      }

      // Set appropriate content type
      const ext = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });
});

// Create WebSocket server (handles upgrade requests automatically)
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
server.listen(PORT, HOST, () => {
  console.log(`YouTube Sync server running on port ${PORT}`);
  if (process.env.NODE_ENV === "production") {
    console.log(
      `App is available at: http://${
        HOST === "0.0.0.0" ? "localhost" : HOST
      }:${PORT}`
    );
  } else {
    console.log(`WebSocket server: ws://localhost:${PORT}`);
    console.log(
      `To find your local IP, run: ifconfig (Mac/Linux) or ipconfig (Windows)`
    );
  }
});
