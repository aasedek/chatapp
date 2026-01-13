# Deploying to Vercel

This guide provides step-by-step instructions for deploying your ephemeral secure chat application to Vercel.

## Overview

Your application has two components:
- **Frontend**: React + Vite application
- **Backend**: Express server with WebSocket support and Redis

**Important**: Vercel is primarily designed for frontend and serverless functions. The WebSocket signaling server presents challenges:
- Vercel serverless functions have a 10-second timeout for Hobby plans and 5-minute max for Pro
- WebSocket connections need persistent connections, which aren't ideal for serverless

## Recommended Architecture

### Option 1: Hybrid Deployment (Recommended)

Deploy frontend on Vercel, backend elsewhere:
- **Frontend**: Deploy to Vercel
- **Backend**: Deploy to Railway, Render, or DigitalOcean
- **Redis**: Use Upstash Redis (serverless) or Redis Cloud

### Option 2: Full Vercel (Limited)

Convert backend to serverless functions with limitations:
- WebSocket connections will be short-lived
- Better suited for HTTP polling instead of WebSockets
- Requires significant architecture changes

---

## Option 1: Hybrid Deployment (Step-by-Step)

### Part A: Deploy Backend to Railway/Render

#### Using Railway (Recommended)

1. **Sign up for Railway**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create a New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub repository

3. **Configure Backend Service**
   - Railway will auto-detect your monorepo
   - Click "Add Service" → "GitHub Repo"
   - Set root directory to `backend`
   - Set start command: `npm run start`
   - Set build command: `npm run build`

4. **Add Redis**
   - In your Railway project, click "New"
   - Select "Database" → "Add Redis"
   - Railway will automatically set `REDIS_URL` environment variable

5. **Set Environment Variables**
   ```
   PORT=3001
   REDIS_HOST=(provided by Railway Redis)
   REDIS_PORT=(provided by Railway Redis)
   CORS_ORIGIN=https://your-app.vercel.app
   NODE_ENV=production
   ```

6. **Deploy**
   - Railway will automatically deploy
   - Note your backend URL (e.g., `https://your-backend.up.railway.app`)

#### Alternative: Using Render

1. **Sign up for Render**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`

3. **Add Redis**
   - Click "New" → "Redis"
   - Note the connection details

4. **Set Environment Variables** (same as Railway)

### Part B: Deploy Frontend to Vercel

1. **Prepare Frontend for Deployment**

   Create a `vercel.json` in the root directory:

   ```json
   {
     "buildCommand": "cd frontend && npm install && npm run build",
     "outputDirectory": "frontend/dist",
     "framework": "vite",
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

2. **Update Frontend Environment Variables**

   Create `frontend/.env.production`:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   VITE_WS_URL=wss://your-backend.up.railway.app
   ```

3. **Install Vercel CLI** (Optional)
   ```bash
   npm install -g vercel
   ```

4. **Deploy via Vercel CLI**
   ```bash
   cd d:\COMAPP
   vercel
   ```

   Or **Deploy via Vercel Dashboard**:
   - Go to https://vercel.com
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Configure:
     - Framework Preset: Vite
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output Directory: `dist`
   - Add Environment Variables:
     ```
     VITE_API_URL=https://your-backend.up.railway.app
     VITE_WS_URL=wss://your-backend.up.railway.app
     ```
   - Click "Deploy"

5. **Update Backend CORS**

   After deployment, update your backend's `CORS_ORIGIN` environment variable with your Vercel URL:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```

---

## Option 2: Full Vercel Deployment (Advanced)

This requires restructuring your application significantly.

### Prerequisites

- Convert WebSocket signaling to HTTP polling or use a third-party WebSocket service
- Use Upstash Redis (serverless Redis)

### Steps

1. **Create Serverless API Routes**

   Create `api/` directory in root:
   ```
   api/
     sessions.ts
     signaling.ts
     health.ts
   ```

2. **Update vercel.json**
   ```json
   {
     "builds": [
       {
         "src": "frontend/package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "dist"
         }
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/$1"
       },
       {
         "src": "/(.*)",
         "dest": "/frontend/dist/$1"
       }
     ]
   }
   ```

3. **Use Upstash Redis**
   - Sign up at https://upstash.com
   - Create a Redis database
   - Get connection details
   - Add to Vercel environment variables:
     ```
     UPSTASH_REDIS_REST_URL=...
     UPSTASH_REDIS_REST_TOKEN=...
     ```

4. **Limitations**
   - No persistent WebSocket connections
   - Need to implement polling or use third-party services like Pusher, Ably
   - Session management becomes more complex

---

## Recommended: Use Option 1

For your application, **Option 1 (Hybrid Deployment)** is strongly recommended because:

1. ✅ Your WebSocket signaling server needs persistent connections
2. ✅ Redis works better with traditional hosting
3. ✅ Easier to maintain and debug
4. ✅ No architecture changes needed
5. ✅ Better performance for real-time features

## Cost Estimates

### Railway/Render + Vercel
- **Vercel**: Free (Hobby plan supports this use case)
- **Railway**: ~$5/month (backend + Redis)
- **Render**: Free tier available, ~$7/month for production

### Full Vercel + Upstash
- **Vercel**: Free (Hobby)
- **Upstash**: Free tier available, ~$10/month for production
- **Additional**: May need Pusher/Ably for WebSockets (~$49/month)

## Final Checklist

- [ ] Backend deployed to Railway/Render
- [ ] Redis database created and connected
- [ ] Backend environment variables configured
- [ ] Frontend environment variables point to backend URL
- [ ] Frontend deployed to Vercel
- [ ] Backend CORS updated with Vercel URL
- [ ] Test end-to-end functionality
- [ ] Set up custom domain (optional)

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Render Docs**: https://render.com/docs

## Security Notes

1. Always use HTTPS/WSS in production
2. Keep environment variables secret
3. Enable rate limiting on your backend
4. Consider adding authentication if needed
5. Regularly update dependencies

---

Good luck with your deployment! 🚀
