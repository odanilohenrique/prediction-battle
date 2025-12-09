# Prediction Battle 🔥

**Bet USDC on Farcaster cast performance. Win big if you predict correctly.**

A Farcaster Mini App where users can bet USDC on whether casts will hit engagement targets (likes, recasts, replies) within 24 hours. Winners split 80% of the pot proportionally, 20% goes to the platform.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- A Neynar API key (free tier)
- A Base wallet address

### Installation

1. **Clone and install dependencies:**
```bash
cd "c:\APPS\Prediction Batle"
npm install
```

2. **Set up environment variables:**
```bash
# Copy the example file
copy .env.local.example .env.local

# Edit .env.local and fill in:
# - RECEIVER_ADDRESS: Your Base wallet address (0x...)
# - NEYNAR_API_KEY: Get from https://neynar.com
# - NEXT_PUBLIC_URL: http://localhost:3000 (for local dev)
```

3. **Get a Neynar API Key (Free):**
   - Go to [neynar.com](https://neynar.com)
   - Sign up for a free account
   - Navigate to API Keys section
   - Create a new API key
   - Copy it to your `.env.local` file

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - You should see trending Farcaster casts!

---

## 🌐 Deploying to Vercel

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Deploy:**
```bash
vercel
```

4. **Configure environment variables in Vercel:**
   - Go to your project dashboard on [vercel.com](https://vercel.com)
   - Navigate to Settings → Environment Variables
   - Add:
     - `RECEIVER_ADDRESS`: Your Base wallet address
     - `NEYNAR_API_KEY`: Your Neynar API key
     - `NEXT_PUBLIC_URL`: Your Vercel deployment URL (e.g., `https://prediction-battle.vercel.app`)

5. **Redeploy to apply environment variables:**
```bash
vercel --prod
```

### Option 2: GitHub + Vercel (Automatic Deployments)

1. **Push your code to GitHub:**
```bash
git init
git add.
git commit -m "Initial Prediction Battle app"
git remote add origin https://github.com/YOUR_USERNAME/prediction-battle.git
git push -u origin main
```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables (same as above)
   - Deploy!

---

## 📋 Features

### ✅ Completed
- 🔥 **Trending Casts Feed**: View popular Farcaster casts from the last few hours
- 🎲 **Prediction Creation**: Choose metric (likes, recasts, replies), target value, and bet amount
- 💰 **Bet Management**: Track active and past predictions
- 📊 **Statistics Dashboard**: View your win/loss record and net profit
- 🎯 **Result Checking**: Automated endpoint to check expired predictions and distribute payouts
- 🎨 **Premium UI**: Matte black (#0F0F0F) with amber (#FF9500) accents, smooth animations

### 🚧 Coming Soon (Integration Required)
- 💳 **MiniKit Payments**: USDC payments via x402 on Base network
- 🔐 **Authentication**: User login via Farcaster
- 📱 **Share to Farcaster**: Post predictions directly from the app
- 💸 **Automated Payouts**: Send USDC to winners automatically
- 🗄️ **Persistent Storage**: Migrate from in-memory to Vercel KV or Supabase

---

## 🛠️ Project Structure

```
c:\APPS\Prediction Batle\
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Main homepage with tabs
│   │   ├── globals.css         # Global styles
│   │   └── api/
│   │       ├── casts/
│   │       │   └── trending/
│   │       │       └── route.ts   # Fetch trending casts
│   │       ├── predictions/
│   │       │   ├── create/
│   │       │   │   └── route.ts   # Create prediction + add bet
│   │       │   └── list/
│   │       │       └── route.ts   # List user's predictions
│   │       └── check/
│   │           └── route.ts       # Check expired predictions
│   ├── components/
│   │   ├── CastCard.tsx        # Display cast with predict button
│   │   ├── PredictionModal.tsx # 3-step prediction creation
│   │   ├── BetCard.tsx         # Display individual bet
│   │   ├── ActiveBets.tsx      # List active predictions
│   │   └── PastBets.tsx        # List completed predictions
│   └── lib/
│       ├── types.ts            # TypeScript type definitions
│       ├── neynar.ts           # Neynar API client
│       ├── predictions.ts      # In-memory prediction store
│       └── minikit.ts          # MiniKit placeholders
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── .env.local.example
```

---

## 🔧 API Endpoints

### `GET /api/casts/trending`
Fetch trending Farcaster casts

**Response:**
```json
{
  "success": true,
  "casts": [...]
}
```

### `POST /api/predictions/create`
Create a new prediction and add a bet

**Body:**
```json
{
  "castHash": "0x...",
  "castAuthor": "username",
  "castText": "...",
  "metric": "likes",
  "targetValue": 100,
  "choice": "yes",
  "betAmount": 0.1,
  "initialValue": 50
}
```

### `GET /api/predictions/list?userId=XXX&status=active`
List user's predictions

**Query Params:**
- `userId`: User identifier
- `status`: `active` or `completed`

### `POST /api/check` (Manual Trigger)
Check expired predictions and distribute payouts

**Response:**
```json
{
  "success": true,
  "checked": 5,
  "results": [...]
}
```

---

## 🎨 Design System

### Colors
- **Background**: `#0F0F0F` (Matte Black)
- **Surface**: `#1A1A1A` (Lighter Black)
- **Primary**: `#FF9500` (Amber)
- **Secondary**: `#FFB84D` (Light Amber)
- **Dark Gray**: `#333333`
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#AAAAAA`

### Typography
- **Font**: Inter (Google Fonts)

---

## ⚠️ Known Limitations (MVP)

1. **In-Memory Storage**: Predictions reset on server restart
   - **Fix**: Migrate to Vercel KV or Supabase

2. **No Real Payments**: MiniKit integration is placeholder
   - **Fix**: Implement actual x402 payment flow

3. **Manual Result Checking**: `/api/check` must be triggered manually
   - **Fix**: Set up Vercel Cron Jobs (requires Pro plan) or external scheduler

4. **No Authentication**: Uses demo user ID
   - **Fix**: Integrate Farcaster authentication via MiniKit

5. **No Anti-Spam**: Users can create unlimited predictions
   - **Fix**: Add rate limiting and minimum bet requirements

---

## 🐛 Troubleshooting

### "Error fetching trending casts"
- Check that `NEYNAR_API_KEY` is set correctly in `.env.local`
- Verify your Neynar API key is active at [neynar.com](https://neynar.com)

### Images not loading
- Ensure Neynar image domains are whitelisted in `next.config.js`
- Check browser console for CORS errors

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Delete `.next` folder and rebuild: `rm -rf .next && npm run build`

---

## 📚 Resources

- [Farcaster Mini Apps Documentation](https://miniapps.farcaster.xyz/)
- [Neynar API Docs](https://docs.neynar.com/)
- [Coinbase OnchainKit](https://onchainkit.xyz/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)

---

## 📄 License

MIT

---

## 🙋 Support

For issues or questions, open an issue on GitHub or reach out on Farcaster!

**Built with ❤️ for the Farcaster community**
