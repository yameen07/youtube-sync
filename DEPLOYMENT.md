# Deployment Guide - YouTube Sync

This guide will help you deploy the YouTube Sync app to various hosting platforms so you can use it from anywhere.

## Table of Contents

1. [Quick Start (Local Network)](#quick-start-local-network)
2. [Cloud Hosting Options](#cloud-hosting-options)
   - [Railway](#railway)
   - [Render](#render)
   - [Heroku](#heroku)
   - [Docker Deployment](#docker-deployment)
3. [Manual VPS Deployment](#manual-vps-deployment)
4. [Troubleshooting](#troubleshooting)

---

## Quick Start (Local Network)

For local Wi-Fi network use, follow the original README instructions. The app works on your local network without any cloud hosting.

---

## Cloud Hosting Options

### Railway

[Railway](https://railway.app) offers easy deployment with automatic HTTPS.

**Steps:**

1. **Sign up** at [railway.app](https://railway.app) (GitHub login available)

2. **Create a new project:**

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure deployment:**

   - Railway will automatically detect the `railway.json` configuration
   - The build process will:
     - Install server dependencies
     - Install client dependencies
     - Build the React app
     - Start the server

4. **Get your URL:**

   - Railway will provide a URL like `https://your-app.up.railway.app`
   - Share this URL with anyone to use the app

5. **Usage:**
   - Open the URL in any browser
   - Click "Host (Laptop)" to control playback
   - Share the URL with others who click "Client (Mobile/Laptop)"
   - No need to enter IP addresses - it works automatically!

**Cost:** Free tier available, paid plans start at $5/month

---

### Render

[Render](https://render.com) provides free hosting with automatic SSL.

**Steps:**

1. **Sign up** at [render.com](https://render.com) (GitHub login available)

2. **Create a new Web Service:**

   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure the service:**

   - **Name:** youtube-sync (or any name)
   - **Environment:** Node
   - **Build Command:** `cd server && npm install && cd ../client && npm install && npm run build`
   - **Start Command:** `cd server && node server.js`
   - **Plan:** Free (or choose a paid plan)

4. **Environment Variables (optional):**

   - `NODE_ENV=production`
   - `PORT=8080` (Render will set this automatically)

5. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your app will be available at `https://your-app.onrender.com`

**Note:** Free tier services spin down after 15 minutes of inactivity. First request may take ~30 seconds to wake up.

**Cost:** Free tier available, paid plans start at $7/month

---

### Heroku

[Heroku](https://heroku.com) is a popular platform for Node.js apps.

**Steps:**

1. **Install Heroku CLI:**

   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku:**

   ```bash
   heroku login
   ```

3. **Create a new app:**

   ```bash
   heroku create your-app-name
   ```

4. **Set environment variables:**

   ```bash
   heroku config:set NODE_ENV=production
   ```

5. **Deploy:**

   ```bash
   git push heroku main
   ```

6. **Open your app:**
   ```bash
   heroku open
   ```

**Cost:** Free tier discontinued, paid plans start at $5/month

---

### Docker Deployment

Deploy using Docker to any platform that supports containers (AWS, Google Cloud, DigitalOcean, etc.).

**Build and run locally:**

```bash
# Build the Docker image
docker build -t youtube-sync .

# Run the container
docker run -p 8080:8080 youtube-sync
```

**Deploy to platforms:**

- **Fly.io:** `flyctl launch` (uses Dockerfile automatically)
- **DigitalOcean App Platform:** Connect GitHub repo, auto-detects Dockerfile
- **AWS ECS/Fargate:** Push to ECR, deploy via ECS
- **Google Cloud Run:** `gcloud run deploy` (uses Dockerfile)

---

## Manual VPS Deployment

Deploy to your own VPS (DigitalOcean, Linode, AWS EC2, etc.).

### Prerequisites

- VPS with Ubuntu/Debian
- Node.js 14+ installed
- Domain name (optional, for HTTPS)

### Steps

1. **SSH into your server:**

   ```bash
   ssh user@your-server-ip
   ```

2. **Clone your repository:**

   ```bash
   git clone https://github.com/your-username/youtube-sync.git
   cd youtube-sync
   ```

3. **Install dependencies and build:**

   ```bash
   cd server
   npm install
   cd ../client
   npm install
   npm run build
   ```

4. **Install PM2 (process manager):**

   ```bash
   npm install -g pm2
   ```

5. **Start the server with PM2:**

   ```bash
   cd ../server
   pm2 start server.js --name youtube-sync
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start on boot
   ```

6. **Set up Nginx (for HTTPS and reverse proxy):**

   ```bash
   sudo apt install nginx
   ```

   Create `/etc/nginx/sites-available/youtube-sync`:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the site:

   ```bash
   sudo ln -s /etc/nginx/sites-available/youtube-sync /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Set up SSL with Let's Encrypt:**

   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

8. **Your app is now live at:** `https://your-domain.com`

---

## Usage After Deployment

Once deployed, the app works differently than local network mode:

### For Host (Controller):

1. Open the deployed URL in your browser
2. Click **"Host (Laptop)"**
3. Click **"Connect"** (no IP needed - uses same URL)
4. Load a video and control playback

### For Clients (Viewers):

1. Open the **same URL** in any browser (anywhere in the world!)
2. Click **"Client (Mobile/Laptop)"**
3. Click **"Connect"** (no IP needed - uses same URL)
4. Wait for host to load a video
5. Playback syncs automatically

**Key Difference:** Everyone uses the same URL - no need to share IP addresses!

---

## Troubleshooting

### WebSocket Connection Issues

**Problem:** Clients can't connect to WebSocket server

**Solutions:**

- Ensure your hosting platform supports WebSocket connections
- Check that the platform allows WebSocket upgrades (most modern platforms do)
- Verify the server is listening on the correct port
- Check firewall rules if using VPS

### Build Failures

**Problem:** Build fails during deployment

**Solutions:**

- Ensure Node.js version is 14+ (check `engines` in package.json)
- Verify all dependencies are listed in package.json
- Check build logs for specific errors
- Try building locally first: `cd client && npm run build`

### HTTPS/SSL Issues

**Problem:** WebSocket fails on HTTPS sites

**Solutions:**

- Ensure you're using `wss://` (secure WebSocket) for HTTPS sites
- The app automatically detects and uses the correct protocol
- Check that your hosting platform provides SSL certificates

### Port Configuration

**Problem:** App doesn't start or wrong port

**Solutions:**

- Most platforms set `PORT` environment variable automatically
- Check platform documentation for port configuration
- The server uses `process.env.PORT || 8080` as fallback

### CORS Issues

**Problem:** Browser blocks requests

**Solutions:**

- The app serves everything from the same origin, so CORS shouldn't be an issue
- If you see CORS errors, check that the client is being served from the same domain as the WebSocket server

---

## Environment Variables

You can configure the app using environment variables:

- `PORT`: Server port (default: 8080)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment mode (production/development)

Most hosting platforms set these automatically.

---

## Cost Comparison

| Platform | Free Tier | Paid Plans  | Best For                   |
| -------- | --------- | ----------- | -------------------------- |
| Railway  | ✅ Yes    | $5/month    | Easy deployment, great DX  |
| Render   | ✅ Yes    | $7/month    | Free tier with auto-SSL    |
| Heroku   | ❌ No     | $5/month    | Established platform       |
| VPS      | ❌ No     | $5-20/month | Full control, custom setup |
| Fly.io   | ✅ Yes    | $1.94/month | Global edge deployment     |

---

## Support

For issues or questions:

1. Check the browser console for errors
2. Review server logs on your hosting platform
3. Verify all prerequisites are met
4. Check the main README.md for local setup troubleshooting

---

## Next Steps

After deployment:

- Share your app URL with friends
- Use it from anywhere in the world
- No need to be on the same Wi-Fi network
- Enjoy synchronized YouTube playback!
