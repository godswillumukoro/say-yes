# sayYes – Voice-first dating app (hackathon prototype)

# sayYes - Voice-Only Dating App

## Project Overview

**sayYes** is a fully voice-controlled dating application that reimagines how people connect online. No typing, no clicking, no scrolling with a mouse—just your voice guiding every interaction. From onboarding to matching, users navigate the entire experience through natural conversation and voice commands.

**Live Demo:** [Your deployment URL]  
**GitHub Repository:** [Your repo URL]

---

## The Concept

Traditional dating apps are exhausting. Endless swiping, crafting the perfect bio, selecting the right photos—it's become work. sayYes strips away all that friction by letting users interact naturally through voice alone.

The app guides you through:
- **Voice-driven onboarding** - Answer questions conversationally about your name, age, interests, and preferences
- **AI-powered photo generation** - Take a casual photo, and Google's Imagen 3 (via Nano Banana) transforms it into professional, date-ready portraits
- **Voice-commanded matching** - Say "yes," "yeah," or "absolutely" to like someone; "no," "nope," or "pass" to skip
- **Real-time matching** - When two people like each other, they're instantly connected with contact details and can start chatting

---

## Why I Built This with goose

I've been following goose since Angie Jones and Jason Lengstorf's announcement video dropped, and I watched it the same day it came out. As someone who knows both Angie and Jason personally, I was immediately captivated by what they were building. The concept of autonomous AI agents that could handle entire workflows—planning, coding, testing, debugging, deployment—felt like exactly what I needed.

The reality is, I've been buried in work for months. When this hackathon was announced, I desperately wanted to participate, but the thought of manually coding an entire full-stack application, debugging API integrations, setting up WebSocket infrastructure, and handling deployment felt impossible given my schedule.

**That's where goose became transformative.**

### My goose Strategy

I structured my development using specialized subagents, each with clear responsibilities:

#### 1. **Planning Agent**
**Prompt:** *"Act as a technical architect. Review the sayYes dating app requirements and create a comprehensive technical specification covering database schema, API endpoints, voice integration points, and deployment strategy. Prioritize simplicity and speed."*

This agent mapped out the entire architecture in minutes—defining the SQLite schema for users, profiles, swipes, and matches; outlining the REST and WebSocket endpoints; and planning the Deepgram STT/TTS integration strategy.

#### 2. **Backend Developer Agent**
**Prompt:** *"You are a Node.js backend specialist. Build a REST API with SQLite for user management, profile creation, swiping logic, and match detection. Implement WebSocket support for real-time notifications. Use Express and keep dependencies minimal."*

This agent scaffolded the entire backend, including authentication flow, swipe logic that detects mutual likes, and the WebSocket server for instant match notifications.

#### 3. **Frontend Voice Integration Agent**
**Prompt:** *"You are a voice UI specialist. Implement voice-controlled navigation using Deepgram's speech-to-text and text-to-speech APIs. Create conversational flows for onboarding, photo approval, and swiping. Handle voice command variations like 'yes/yeah/yup' and 'no/nope/nah.' Make the experience feel natural and forgiving."*

This agent built the voice interaction layer, handling microphone access, streaming audio to Deepgram, processing transcriptions, and playing back voice responses. It intelligently mapped natural speech patterns to app actions.

#### 4. **Image Generation Agent**
**Prompt:** *"Integrate Google's Imagen 3 API (Nano Banana) for AI-powered photo enhancement. Take user camera input, send it with a cinematic dating photo prompt, and return professional portraits. Handle API errors gracefully and provide voice feedback on generation status."*

This agent handled the camera integration and Google AI Studio API calls, transforming casual selfies into polished dating profile photos.

#### 5. **Testing & Debugging Agent**
**Prompt:** *"Act as a QA engineer. Test all voice flows, identify edge cases (background noise, accent variations, simultaneous API calls), debug WebSocket connection issues, and ensure smooth deployment to Google Cloud Run. Fix any bugs you find."*

This was perhaps the most valuable agent. As features came together, this agent caught race conditions in the matching logic, fixed CORS issues with the WebSocket server, debugged voice command recognition failures, and ultimately ensured the production deployment was stable.

---

## Why This Experience Validated goose for Me

Before this hackathon, I understood goose conceptually. But actually *using* it under time pressure revealed its true power:

### 1. **Parallel Workstreams**
While the backend agent was building API endpoints, the frontend agent was simultaneously working on voice flows. The planning agent had given both of them clear contracts to work against, so integration was seamless.

### 2. **Specialized Expertise**
Each agent brought deep knowledge to its domain. The voice integration agent knew about audio streaming, silence detection, and natural language variation. The testing agent caught bugs I never would have thought to look for.

### 3. **Persistent Focus**
Unlike me—juggling work meetings, context switching, fighting fatigue—the agents maintained perfect focus. They didn't get distracted. They didn't forget implementation details. They executed relentlessly.

### 4. **Rapid Iteration**
When users tested early builds and said "the voice commands feel robotic," I prompted the voice agent to make responses more conversational and warm. Within minutes, the entire tone shifted. That kind of iteration speed is unprecedented.

---

## The Reality of Modern Development

I don't have the luxury of extended focus time anymore. Between work obligations, meetings, and life, carving out 8-hour coding sessions is impossible. But I still want to build. I still have ideas that deserve to exist.

**goose doesn't just speed up development—it makes development possible again.**

Without goose, this project wouldn't exist. Not because it's technically complex, but because the cumulative time required—planning, coding, debugging, deploying, iterating—would have pushed the deadline beyond reach.

With goose, I went from concept to deployed application in days, not weeks. The subagent architecture meant I could work in short bursts, delegating complex tasks to specialized agents while I handled high-level direction.

---

## Technical Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js, Express, SQLite
- **Voice:** Deepgram STT/TTS
- **Image Generation:** Google AI Studio (Imagen 3 via Nano Banana)
- **Real-time:** WebSockets for match notifications
- **Deployment:** Google Cloud Run
- **Development:** goose with specialized subagent recipes

---

## The Impact

sayYes proves that voice-first interfaces aren't just novelties—they're legitimate alternatives to traditional UIs. For users with accessibility needs, for people multitasking, for anyone tired of typing and tapping, voice control unlocks new possibilities.

But more importantly, this project proves that **goose empowers builders to execute on ambitious ideas even when time is scarce.**

I've always wanted to build faster. goose showed me I can.

---

## Final Thoughts

This hackathon asked us to eliminate keyboards and mice. But the real constraint I faced was time.

goose eliminated that constraint.

The future of development isn't about replacing developers—it's about multiplying what we're capable of achieving. goose gave me a team of specialists who worked tirelessly while I juggled everything else life throws at you.

**That's why goose matters. That's why this technology is transformative.**

I'm honored to have built sayYes for this hackathon. And I'm genuinely excited about what goose represents for every developer who's ever felt like they don't have enough hours in the day.

Because now, we do.

---

**Built with goose. Controlled by voice. Powered by possibility.**

A simple, voice-controlled dating app using:

- Frontend: vanilla HTML/CSS/JS
- Backend: Node.js (Express), MongoDB
- Voice: Deepgram STT/TTS
- Image Gen: Google AI Studio (Nano Banana) for photo generation

Focus:

- Voice-only onboarding (name, age, bio, email, phone)
- Camera capture and optional photo enhancement via image generation
- Voice and gesture (nod/shake) swiping
- Mutual match screen with both profiles

---

## Prerequisites

- Node.js 18+ and npm
  - macOS (Homebrew):
    ```bash
    brew install node
    ```
- MongoDB (local) or Atlas
  - Local (Homebrew):
    ```bash
    brew tap mongodb/brew
    brew install mongodb-community@7.0
    brew services start mongodb-community@7.0
    # Mongo runs on mongodb://localhost:27017 by default
    ```
  - Or use MongoDB Atlas and copy its connection string to MONGODB_URI
- API keys / DB:
  - Deepgram STT/TTS: `DEEPGRAM_API_KEY`
  - Google AI Studio: `GOOGLE_API_KEY`
  - MongoDB connection: `MONGODB_URI` (default: mongodb://localhost:27017) and `MONGODB_DB` (default: sayyes)

## Setup

1. Open the project directory:

   ```bash
   cd /Users/mac/code/say-yes
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file (next to `server.js`) with your keys:

   ```bash
   cp example.env .env
   # then edit .env and fill values
   ```

   .env contents (example):

   ```bash
   DEEPGRAM_API_KEY=your_deepgram_key
   GOOGLE_API_KEY=your_google_key
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=sayyes
   ```

## Run the app

Ensure MongoDB is running locally (or that your Atlas URI is reachable), then:

```bash
npm start
```

- Server runs at: <http://localhost:3000>
- Static frontend is served from `public/`
- Uploaded/generated images are stored under `assets/` and served at `/assets/...`

## Using the app

1. Welcome screen: tap/click once to proceed.
2. Voice onboarding prompts:
   - “What’s your name?”
   - “What’s your age?” (must be 18+)
   - “Give me a short bio about you.”
   - “What email should matches contact you at?”
   - “What phone number should matches contact you at?”
3. Photo step:
   - Asked: “Would you like me to take a photo of you? Say yes to proceed.”
   - If yes, the camera opens, you take a photo, then we optionally call Google image generation to produce date-ready portraits.
   - You can say yes/no for each generated photo to add it to your profile.
4. Browse/swipe:
   - Say “yes/yeah/yup/…” (or nod) to like, “no/nope/nah/…” (or shake) to pass.
   - On mutual likes, a match page appears showing both names, ages, bio, email, and phone.

## Image generation

- Prompt used (editable in `public/main.js`):
  ```
  A cinematic portrait of a young man in soft golden hour lighting, wearing a relaxed open-collar shirt. The expression — thoughtful yet inviting. Subtle bokeh lights in the background hint at evening city life, evoking anticipation before a first date.
  ```
- The backend endpoint `/api/generate-photos` is a placeholder proxy for Google AI Studio "Nano Banana". Once you confirm the exact model ID and payload format, update `server.js` accordingly (search for `generate-photos`). The app still works if this endpoint returns no photos (it will simply skip adding generated images).

## Endpoints (for reference)

- `POST /api/stt` – Deepgram STT proxy (multipart: audio)
- `POST /api/tts` – Deepgram TTS proxy (JSON: { text }) returns audio/mpeg
- `POST /api/onboarding` – Create a user profile
- `POST /api/photo` – Upload camera photo, returns URL under `/assets`
- `POST /api/generate-photos` – Generate enhanced portraits (placeholder proxy)
- `GET /api/candidates?userId=` – Get other users
- `POST /api/like` – Like/pass; returns `{ isMatch, match }` when mutual
- `GET /api/match/:id?userId=` – Fetch match details
- `GET /api/matches?userId=` – List all your matches

## Demo tips

- Create two users (e.g., you and a friend) to demonstrate matching.
- Use a second browser profile or an incognito window for the second user.

## Troubleshooting

- Mongo connection error: ensure the service is running (`brew services list`) or use a valid Atlas URI in `.env`.
- "npm: command not found": install Node.js (see Prerequisites).
- Mic/camera blocked: allow permissions in the browser.
- No generated photos: verify `GOOGLE_API_KEY` and update the Google model endpoint in `server.js`. You can still proceed without generated photos.
- TTS/STT not speaking/transcribing: verify `DEEPGRAM_API_KEY` and network access.

## Development notes

- DB: MongoDB collections `users` and `likes`. Mutual matches are pairs in `likes` with reciprocal documents.
- Assets: Uploaded/generated images are written to `assets/` and served at `/assets/...`.
- No build step; purely static frontend + Node backend.
- Minimal CSS for a clean dark UI.

## Ready to kickstart?

Yes. Once MongoDB is running, Node is installed, and your `.env` is set, run `npm start` and onboard with your voice, capture a photo, and swipe with voice/gestures. If the Google image generation endpoint isn’t finalized yet, onboarding still completes; you can say “no” to the photo step or proceed and it will simply skip adding generated images if none are returned.

## End of list behavior

- When you reach the end of the stack, the app shows:

  All caught up! Looks like you’ve seen everyone for now.

- There is no refresh button to prevent looping through the same people. New candidates will appear automatically as they become available, and you’ll see matches when they’re mutual.

## Log out / switch user (same browser)

- The app stores a lightweight session in localStorage under `sayyes_user`.
- To log out and start fresh, open the browser DevTools console and run either:
  ```javascript
  clearUser();
  location.reload();
  // or
  localStorage.removeItem("sayyes_user");
  location.reload();
  ```
- After reload, onboarding will start again and you can create/sign in as another user.

