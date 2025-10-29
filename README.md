# sayYes – Voice-first dating app (hackathon prototype)

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
