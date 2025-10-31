# SayYes — Dating, but make it voice-only

**Live:** https://say-yes-476473917671.us-central1.run.app/

## What is this?

A dating app where you never touch a keyboard. Everything—onboarding, swiping, matching—happens through conversation. Just you, your voice, and finding someone special.

## The idea

Dating apps are exhausting. Type your bio. Pick the perfect photos. Endless swiping. It's work.

I wanted something simpler: talk to the app like a friend, let AI handle your photos, say "yes" or "no" to matches. When two people like each other, boom—you're connected.

## How it works

1. **Voice onboarding** — The app asks your name, age, bio, contact info. You just answer naturally.
2. **AI photos** — Take a quick selfie. Google Nano Banana transforms it into professional, date-ready portraits. Say yes to the ones you like.
3. **Voice swiping** — See potential matches. Say "yeah," "absolutely," "hell yeah" to like. Say "nope," "pass," "nah" to skip.
4. **Instant matches** — When you both say yes, you get each other's details. Start chatting.

## Why goose made this possible

I've known Angie Jones and Jason Lengstorf for a while. When they presented goose at the Web Dev Challenge Season 2 Episode 10, I watched the video that same day. The concept of AI agents that could plan, code, debug, and deploy? That hit different.

But I didn't try it. Work kept me buried.

When this hackathon dropped, I had maybe 2 hours a day. Building a full-stack app with voice integration, AI image generation, WebSockets, and deployment? Normally that's weeks of nights and weekends.

**goose changed everything.**

I split the work across specialized agents:

- **Planner agent** mapped the entire architecture—database, APIs, deployment strategy
- **Backend agent** built the Express server, MongoDB setup, swipe logic, match detection
- **Voice agent** handled all the Deepgram integration—made the conversations feel natural, not robotic
- **Image agent** connected the camera to Google's API, generated the portraits
- **Testing agent** caught bugs I'd never have found—race conditions, CORS issues, voice command edge cases etc.

They worked in parallel. While one built the backend, another handled voice flows. When I had 30 minutes between meetings, I'd check in and redirect. When testers said responses felt stiff, I told the voice agent to warm it up—done in minutes.

Without goose, I'd still be writing API endpoints. With goose, I shipped a working app in days.

That's the real magic. Not that it's faster—it's that it makes building possible again when life gets busy.

## The tech (briefly)

- Frontend: HTML, CSS, vanilla JS
- Backend: Node.js, Express, MongoDB
- Voice: Deepgram (STT/TTS)
- Images: Google Nano Banana
- Real-time: WebSockets
- Deployed: Google Cloud Run

## Setup (if you want to run it)

```bash
# Clone and install
cd say-yes
npm install

# Add your keys to .env
DEEPGRAM_API_KEY=your_key
GOOGLE_API_KEY=your_key
MONGODB_URI=mongodb://localhost:27017

# Run
npm start
# Visit http://localhost:3000
```

**Note:** You'll need MongoDB running locally or an Atlas connection.

## Why this matters

Voice interfaces aren't gimmicks. They're the future for accessibility, multitasking, and anyone tired of tapping screens all day.

But more than that—this project proved to me that goose isn't just a productivity tool. It's what makes ambitious ideas achievable when you have real constraints.

I've always wanted to build faster. goose showed me I can.

## A love letter to goose

This hackathon asked us to eliminate keyboards. But my real constraint was time.

goose eliminated that constraint.

It gave me a team of specialists who worked relentlessly while I juggled everything else. The agents didn't get tired. They didn't forget details. They just executed.

That's transformative.

Not because it replaces developers—because it multiplies what we're capable of when we don't have the luxury of 12-hour coding marathons anymore.

Thank you to Angie, Jason, and the entire goose team for bringing to light something that genuinely changes how we create.

This is just the beginning.

---

**Built with goose. Controlled by voice. Made possible by not giving up.**
