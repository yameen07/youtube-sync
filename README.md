# YouTube Sync - Local Wi-Fi Playback Synchronization

A React-based web application that synchronizes YouTube playback (play, pause, seek) across multiple devices on the same Wi-Fi network. One laptop acts as a WebSocket server (host), and other devices connect as clients.

## Features

- ✅ Real-time YouTube playback synchronization
- ✅ WebSocket-based communication (no polling)
- ✅ Mobile-first responsive design
- ✅ No cloud services or authentication required
- ✅ Works entirely on local Wi-Fi network
- ✅ **Deployable to cloud - use from anywhere!**

## 🚀 Quick Deploy

Want to use this app from anywhere in the world? Deploy it to the cloud!

**Quick options:**

- **[Railway](https://railway.app)** - Easiest deployment (free tier available)
- **[Render](https://render.com)** - Free hosting with auto-SSL
- **[Heroku](https://heroku.com)** - Popular platform
- **Docker** - Deploy anywhere that supports containers

👉 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide**

After deployment, everyone uses the same URL - no IP addresses needed!

## Tech Stack

**Backend (Host)**

- Node.js
- WebSocket library (`ws`)

**Frontend**

- React 18
- Vite
- YouTube IFrame Player API
- Native WebSocket API

## Project Structure

```
youtube-sync/
├── server/
│   ├── server.js          # WebSocket server
│   └── package.json        # Server dependencies
├── client/
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   ├── components/
│   │   │   └── YouTubePlayer.jsx  # YouTube player component
│   │   ├── hooks/
│   │   │   └── useWebSocketSync.js  # WebSocket hook
│   │   ├── styles.css     # App styles
│   │   └── main.jsx       # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json       # Client dependencies
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- All devices must be on the same Wi-Fi network

### Step 1: Install Server Dependencies

```bash
cd server
npm install
```

### Step 2: Install Client Dependencies

```bash
cd client
npm install
```

### Step 3: Find Your Local IP Address (Host)

**On Mac/Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**

```bash
ipconfig
```

Look for your local IP address (usually starts with `192.168.x.x` or `10.x.x.x`).

### Step 4: Start the WebSocket Server (Host)

On the laptop that will act as the host:

```bash
cd server
npm start
```

You should see:

```
YouTube Sync WebSocket server running on port 8080
Connect clients to: ws://YOUR_LOCAL_IP:8080
```

**Keep this terminal window open** - the server must be running for synchronization to work.

### Step 5: Start the React App

**On the Host (same laptop):**

```bash
cd client
npm run dev
```

You should see output like:

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.0.102:3000/
```

The app is available at:

- **On your laptop**: `http://localhost:3000`
- **On other devices**: `http://YOUR_IP:3000` (use the IP from Step 3)

**On Mobile/Client Devices:**

1. **Ensure your mobile device is on the same Wi-Fi network** as your laptop
2. Open a browser (Safari, Chrome, Firefox, etc.) on your mobile device
3. Navigate to `http://YOUR_IP:3000` (replace `YOUR_IP` with the IP address from Step 3)
   - Example: `http://192.168.0.102:3000`
4. The app should load - if it doesn't, check the troubleshooting section below

**Quick IP Check:**
You can run `./get-ip.sh` in the project root to quickly see your IP address.

## Usage

### Host Setup

1. Open the app in your browser (`http://localhost:3000`)
2. Click **"Host (Laptop)"**
3. Click **"Connect"** (server should already be running)
4. Enter a YouTube video ID or URL
5. Click **"Load Video"**
6. Control playback - all clients will sync automatically

### Client Setup

1. Open the app in your browser (`http://HOST_IP:3000`)
2. Click **"Client (Mobile/Laptop)"**
3. Enter the host's IP address
4. Click **"Connect"**
5. Wait for the host to load a video
6. Playback will automatically sync with the host

## How It Works

### WebSocket Protocol

The app uses JSON messages for synchronization:

```json
{
  "action": "PLAY | PAUSE | SEEK",
  "time": 23.45,
  "timestamp": 1234567890
}
```

### Sync Flow

1. **Host** controls YouTube player
2. **Host** detects play/pause events
3. **Host** sends events to WebSocket server
4. **Server** broadcasts to all connected clients
5. **Clients** receive events and sync their players
6. **Clients** prevent echo by ignoring events during sync

### Edge Case Handling

- **Infinite Loop Prevention**: Flags prevent sending events that were received from the server
- **Connection Recovery**: Clients automatically attempt to reconnect if connection is lost
- **State Synchronization**: Players seek to the correct time before play/pause to ensure sync

## Troubleshooting

### Can't Connect to Server

- Ensure the WebSocket server is running on the host
- Verify all devices are on the same Wi-Fi network
- Check firewall settings (port 8080 must be open)
- Verify the host IP address is correct

### Playback Not Syncing

- Check browser console for errors
- Ensure WebSocket connection status shows "Connected"
- Verify the host has loaded a video
- Try refreshing the client page

### YouTube Player Not Loading

- Check internet connection (YouTube API requires internet)
- Verify the video ID is correct
- Check browser console for YouTube API errors

## Development

### Running in Development Mode

**Server:**

```bash
cd server
npm start
```

**Client:**

```bash
cd client
npm run dev
```

### Building for Production

```bash
cd client
npm run build
```

The built files will be in `client/dist/`

## Important Notes

- ⚠️ The WebSocket server must be running on the host for the app to work
- ⚠️ All devices must be on the same Wi-Fi network
- ⚠️ The host laptop should not go to sleep while hosting
- ⚠️ This app does not extract or stream YouTube video data - it uses the official YouTube IFrame API

## License

MIT

## Support

For issues or questions, check the browser console for error messages and ensure all prerequisites are met.
