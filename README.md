# SocialSpace PWA

A real-time communication Progressive Web App with voice calls, chat, media sharing, and synchronized video watching.

## Features

- 📱 **PWA**: Installable on Android and iOS devices
- 🎙️ **Voice Calls**: WebRTC-based calls with real-time translation
- 💬 **Chat**: Real-time messaging with text-to-speech
- 🖼️ **Media Sharing**: Upload and share images/videos with drawing tools
- 🎥 **Watch Together**: Synchronized video playback
- 📱 **Mobile Optimized**: Designed for mobile-first experience

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/socialspace-pwa)

## Environment Variables

Create a `.env.local` file with:

\`\`\`env
NEXT_PUBLIC_BACKEND_URL=wss://socialspace-bakend.onrender.com
\`\`\`

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and update values
4. Run development server: `npm run dev`
5. For HTTPS testing: `npm run dev:https`

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the project: `npm run build`
2. Deploy the `.next` folder to your hosting provider

## Backend

This app connects to a WebSocket signaling server. The backend code is included in the repository for reference.

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with WebRTC support

## PWA Installation

Users can install the app by:
- **Android**: Tap "Add to Home Screen" in browser menu
- **iOS**: Tap Share button → "Add to Home Screen"
- **Desktop**: Click install prompt in address bar

## Technical Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Real-time**: WebSocket, WebRTC
- **PWA**: Service Worker, Web App Manifest
- **Mobile**: Touch-optimized, responsive design

## Limitations

- Streaming platforms (Netflix, YouTube) have CORS/DRM restrictions
- Voice translation requires modern browser with Web Speech API
- WebRTC requires HTTPS in production

## License

MIT License
