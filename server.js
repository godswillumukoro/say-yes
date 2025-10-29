import express from "express";
import http from "http";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

const app = express();
const server = http.createServer(app);
let io = null;
const PORT = process.env.PORT || 8080;

// Simple CORS for local dev
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

// Storage for uploads
const upload = multer({ dest: path.join(process.cwd(), "assets") });
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

// Client log sink (top-level)
app.post("/api/client-log", async (req, res) => {
  try {
    const { level = "info", message = "", data = null } = req.body || {};
    const line = `[${new Date().toISOString()}] [${level}] ${message} ${
      data ? JSON.stringify(data) : ""
    }\n`;
    const logFile = path.join(process.cwd(), "assets", "client.log");
    try {
      fs.appendFileSync(logFile, line);
    } catch {}
    console.log(line.trim());
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DB = process.env.MONGODB_DB || "sayyes";
const client = new MongoClient(MONGODB_URI);
let db, Users, Likes, Messages;

// Helpers
function saveBufferToAssets(buf, ext = "bin") {
  const id = crypto.randomBytes(8).toString("hex");
  const rel = `assets/${id}.${ext}`;
  const abs = path.join(process.cwd(), rel);
  fs.writeFileSync(abs, buf);
  return `/${rel}`;
}

async function getUserById(idStr) {
  if (!idStr) return null;
  return Users.findOne({ _id: new ObjectId(idStr) });
}

async function listOtherUsers(excludeIdStr) {
  const excludeId = new ObjectId(excludeIdStr);
  return Users.find({ _id: { $ne: excludeId } })
    .sort({ _id: -1 })
    .toArray();
}

// Deepgram STT proxy
app.post("/api/stt", upload.single("audio"), async (req, res) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: "Missing DEEPGRAM_API_KEY" });
    const audioPath = req.file?.path;
    const mime = req.file?.mimetype || "application/octet-stream";
    const audioData = fs.readFileSync(audioPath);

    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": mime,
        },
        body: audioData,
      }
    );
    const data = await dgRes.json();
    const text =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    res.json({ text, raw: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "STT failed" });
  }
});

// Deepgram TTS proxy (text -> audio)
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: "Missing DEEPGRAM_API_KEY" });

    const dgRes = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      return res.status(500).json({ error: "TTS failed", details: errText });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    const buf = Buffer.from(await dgRes.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "TTS failed" });
  }
});

// Onboarding: create user profile
app.post("/api/onboarding", async (req, res) => {
  try {
    const { name, age, bio, email, phone, photos, gender, interestedIn } =
      req.body; // photos: array of relative URLs

    // Admin: set full photos array for a user
    app.post("/api/admin/set-photos", async (req, res) => {
      try {
        const { userId, photos } = req.body || {};
        if (!userId || !Array.isArray(photos))
          return res
            .status(400)
            .json({ error: "userId and photos[] required" });
        const uId = new ObjectId(String(userId));
        // only allow /assets paths for safety
        const clean = photos.filter(
          (p) => typeof p === "string" && p.startsWith("/assets/")
        );
        const r = await Users.updateOne(
          { _id: uId },
          { $set: { photos: clean } }
        );
        const user = await Users.findOne({ _id: uId });
        res.json({
          ok: true,
          modified: r.modifiedCount,
          user: { id: user._id.toString(), photos: user.photos || [] },
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "set-photos failed" });
      }
    });

    // Admin: append one photo to a user
    app.post("/api/admin/add-photo", async (req, res) => {
      try {
        const { userId, photo } = req.body || {};
        if (
          !userId ||
          !photo ||
          typeof photo !== "string" ||
          !photo.startsWith("/assets/")
        )
          return res
            .status(400)
            .json({ error: 'userId and photo ("/assets/...") required' });
        const uId = new ObjectId(String(userId));
        const r = await Users.updateOne(
          { _id: uId },
          { $push: { photos: photo } }
        );
        const user = await Users.findOne({ _id: uId });
        res.json({
          ok: true,
          modified: r.modifiedCount,
          user: { id: user._id.toString(), photos: user.photos || [] },
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "add-photo failed" });
      }
    });

    if (!name || !age)
      return res.status(400).json({ error: "name and age required" });

    const doc = {
      name,
      age: Number(age),
      bio: bio || "",
      email: email || "",
      phone: phone || "",
      photos: Array.isArray(photos) ? photos : [],
      gender: gender || "",
      interestedIn: interestedIn || "",
      createdAt: new Date(),
    };
    const info = await Users.insertOne(doc);
    const user = await Users.findOne({ _id: info.insertedId });
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        age: user.age,
        bio: user.bio,
        email: user.email,
        phone: user.phone,
        photos: user.photos,
        gender: user.gender || "",
        interestedIn: user.interestedIn || "",
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "onboarding failed" });
  }
});

// Photo upload (camera capture)
app.post("/api/photo", upload.single("photo"), async (req, res) => {
  try {
    const ext = (req.file.mimetype || "").split("/").pop() || "jpg";
    const buf = fs.readFileSync(req.file.path);
    const rel = saveBufferToAssets(buf, ext);
    res.json({ url: rel });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "photo upload failed" });
  }
});

// Google AI Studio Nano Banana image generation - placeholder proxy with logging
app.post("/api/generate-photos", async (req, res) => {
  const startedAt = new Date().toISOString();
  const requestId = crypto.randomBytes(6).toString("hex");
  const logPath = path.join(process.cwd(), "assets", "generation.log");
  const log = (msg) => {
    const line = `[${startedAt}] [${requestId}] ${msg}\n`;
    try {
      fs.appendFileSync(logPath, line);
    } catch {}
    console.log(line.trim());
  };
  try {
    const { prompt, input_image_url, num = 1 } = req.body; // input image optional
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      log("Missing GOOGLE_API_KEY");
      return res
        .status(500)
        .json({ error: "Missing GOOGLE_API_KEY", requestId });
    }

    log(
      `Generate request: num=${num}, promptLength=${
        (prompt || "").length
      }, imageUrl=${input_image_url}`
    );

    // Inline local image so Google doesn’t need to fetch localhost
    let inlineB64 = null,
      mimeType = "image/jpeg";
    try {
      if (input_image_url) {
        // Accept either relative like "/assets/..." or absolute local URLs like "http://localhost:3000/assets/..."
        let rel = input_image_url;
        try {
          if (/^https?:\/\//i.test(input_image_url)) {
            const u = new URL(input_image_url);
            // Only allow inlining if it points to our own assets path
            if (u.pathname && u.pathname.startsWith("/assets/"))
              rel = u.pathname.slice(1);
          } else if (rel.startsWith("/")) {
            rel = rel.slice(1);
          }
        } catch {}
        if (!rel.startsWith("assets/"))
          throw new Error("Refusing to read non-assets path");
        const abs = path.join(process.cwd(), rel);
        const buf = fs.readFileSync(abs);
        inlineB64 = buf.toString("base64");
        const ext = path.extname(abs).toLowerCase();
        mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        log(`Loaded local image ${abs} (${buf.length} bytes)`);
      }
    } catch (e) {
      log(`Failed to read local image: ${e?.message}`);
    }

    // Prepare common request pieces
    const model = process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";
    const partsSdk = [
      { text: prompt || "Refine this photo into a date-ready portrait." },
      ...(inlineB64 ? [{ inlineData: { mimeType, data: inlineB64 } }] : []),
    ];
    const partsHttp = [
      { text: prompt || "Refine this photo into a date-ready portrait." },
      ...(inlineB64
        ? [{ inline_data: { mime_type: mimeType, data: inlineB64 } }]
        : []),
    ];

    // Try SDK first (mirrors working nano_banana.js)
    let out = [];
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: partsSdk }],
      });
      const candidates = response?.candidates || [];
      for (const c of candidates) {
        const parts = c?.content?.parts || [];
        for (const p of parts) {
          const id = p?.inlineData;
          if (id?.data) {
            try {
              const b = Buffer.from(id.data, "base64");
              const rel = saveBufferToAssets(
                b,
                (id.mimeType || "image/png").split("/")?.pop()
              );
              out.push(rel);
            } catch (e) {
              log(`Failed save inlineData (SDK): ${e?.message}`);
            }
          }
        }
      }
    } catch (sdkErr) {
      log(`SDK path failed: ${sdkErr?.message || sdkErr}`);
    }

    // If SDK didn’t return anything, fall back to HTTP v1beta
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;

    // Basic timeout handling
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);

    const contents = [{ role: "user", parts: partsHttp }];
    const payload = {
      contents,
      generationConfig: { candidateCount: Math.min(Number(num) || 4, 4) },
    };
    let genRes;
    try {
      genRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(t);
      log(`Fetch error: ${err?.message || err}`);
      return res.status(502).json({
        error: "upstream fetch failed",
        requestId,
        details: String(err),
      });
    }
    clearTimeout(t);

    const status = genRes.status;
    const text = await genRes.text();
    log(`Upstream status=${status} bodyLength=${text.length}`);

    if (!genRes.ok && out.length === 0) {
      log(`Upstream error body: ${text.slice(0, 500)}`);
      return res.status(502).json({
        error: "image generation failed",
        requestId,
        details: text.slice(0, 1000),
      });
    }
    // Parse HTTP response if SDK produced nothing
    if (out.length === 0) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        log("Failed to parse JSON from upstream");
        return res
          .status(502)
          .json({ error: "invalid upstream response", requestId });
      }

      if (Array.isArray(data?.images)) {
        for (const img of data.images) {
          try {
            const b = Buffer.from(img.base64, "base64");
            const rel = saveBufferToAssets(
              b,
              img.mime?.split("/")?.pop() || "png"
            );
            out.push(rel);
          } catch (e) {
            log(`Failed to decode image: ${e?.message}`);
          }
        }
      }
      if (out.length === 0 && Array.isArray(data?.candidates)) {
        for (const c of data.candidates) {
          const parts = c?.content?.parts || [];
          for (const p of parts) {
            const inl = p?.inline_data || p?.inlineData;
            if (inl?.data) {
              try {
                const b = Buffer.from(inl.data, "base64");
                const rel = saveBufferToAssets(
                  b,
                  (inl.mime_type || inl.mimeType || "image/png")
                    .split("/")
                    ?.pop()
                );
                out.push(rel);
              } catch (e) {
                log(`Failed save inline_data: ${e?.message}`);
              }
            }
          }
        }
      }
    }

    log(`Generated images count=${out.length}`);
    return res.json({
      requestId,
      photos: out.slice(0, Math.min(Number(num) || 4, 4)),
    });
  } catch (e) {
    log(`Handler error: ${e?.stack || e}`);
    res.status(500).json({ error: "image generation failed", requestId });
  }
});

// Candidate feed: users excluding current user, newest first
app.get("/api/candidates", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });
    const others = await listOtherUsers(userId);
    res.json({
      candidates: others.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        age: u.age,
        bio: u.bio,
        email: u.email,
        phone: u.phone,
        photos: u.photos || [],
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "candidates failed" });
  }
});

// Like/Swipe
app.post("/api/like", async (req, res) => {
  try {
    const { userId, targetId, liked } = req.body; // liked: true/false
    if (!userId || !targetId)
      return res.status(400).json({ error: "userId and targetId required" });
    const likerId = new ObjectId(String(userId));
    const likedId = new ObjectId(String(targetId));

    if (liked) {
      await Likes.updateOne(
        { likerId, likedId },
        { $setOnInsert: { likerId, likedId, createdAt: new Date() } },
        { upsert: true }
      );
    }

    const reciprocal = await Likes.findOne({
      likerId: likedId,
      likedId: likerId,
    });
    const isMatch = !!reciprocal;

    let matchDetails = null;
    if (isMatch) {
      const me = await Users.findOne({ _id: likerId });
      const them = await Users.findOne({ _id: likedId });
      matchDetails = {
        me: {
          id: me._id.toString(),
          name: me.name,
          age: me.age,
          bio: me.bio,
          email: me.email,
          phone: me.phone,
          photos: me.photos || [],
        },
        them: {
          id: them._id.toString(),
          name: them.name,
          age: them.age,
          bio: them.bio,
          email: them.email,
          phone: them.phone,
          photos: them.photos || [],
        },
      };
    }

    res.json({ ok: true, isMatch, match: matchDetails });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "like failed" });
  }
});

// Match details by other user id (if matched)
app.get("/api/match/:id", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    const otherId = String(req.params.id || "");
    if (!userId || !otherId)
      return res.status(400).json({ error: "userId and id required" });
    const uId = new ObjectId(userId);
    const oId = new ObjectId(otherId);

    const hasLike = await Likes.findOne({ likerId: uId, likedId: oId });
    const hasRecip = await Likes.findOne({ likerId: oId, likedId: uId });
    if (hasLike && hasRecip) {
      const me = await Users.findOne({ _id: uId });
      const them = await Users.findOne({ _id: oId });
      return res.json({
        match: {
          me: {
            id: me._id.toString(),
            name: me.name,
            age: me.age,
            bio: me.bio,
            email: me.email,
            phone: me.phone,
            photos: me.photos || [],
          },
          them: {
            id: them._id.toString(),
            name: them.name,
            age: them.age,
            bio: them.bio,
            email: them.email,
            phone: them.phone,
            photos: them.photos || [],
          },
        },
      });
    }
    res.json({ match: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "match failed" });
  }
});

// List matches for a user
app.get("/api/matches", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });
    const uId = new ObjectId(userId);

    // Find mutual likes via aggregation
    const matches = await Likes.aggregate([
      { $match: { likerId: uId } },
      {
        $lookup: {
          from: "likes",
          let: { likedId: "$likedId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$likerId", "$$likedId"] },
                    { $eq: ["$likedId", uId] },
                  ],
                },
              },
            },
          ],
          as: "recip",
        },
      },
      { $match: { recip: { $ne: [] } } },
      {
        $lookup: {
          from: "users",
          localField: "likedId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $replaceRoot: { newRoot: "$user" } },
    ]).toArray();

    res.json({
      matches: matches.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        age: u.age,
        bio: u.bio,
        email: u.email,
        phone: u.phone,
        photos: u.photos || [],
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "matches failed" });
  }
});

// Fetch messages between two users
app.get("/api/messages", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    const otherId = String(req.query.otherId || "");
    if (!userId || !otherId)
      return res.status(400).json({ error: "userId and otherId required" });
    const convoId = [userId, otherId].sort().join(":");
    const items = await Messages.find({ convoId })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
    res.json({
      messages: items.map((m) => ({
        id: m._id.toString(),
        from: m.from,
        to: m.to,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "messages failed" });
  }
});

// Conversation list (Instagram-like): last message per peer
app.get("/api/conversations", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });
    const pipeline = [
      { $match: { $or: [{ from: userId }, { to: userId }] } },
      {
        $addFields: {
          peer: {
            $cond: [{ $eq: ["$from", userId] }, "$to", "$from"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$peer",
          last: { $first: "$text" },
          lastAt: { $first: "$createdAt" },
        },
      },
      { $sort: { lastAt: -1 } },
    ];
    const groups = await Messages.aggregate(pipeline).toArray();
    const peers = await Users.find({
      _id: { $in: groups.map((g) => new ObjectId(g._id)) },
    })
      .project({ name: 1, age: 1, photos: 1, interestedIn: 1 })
      .toArray();
    const peerById = new Map(peers.map((p) => [p._id.toString(), p]));
    const out = groups.map((g) => {
      const p = peerById.get(g._id) || {};
      return {
        user: {
          id: g._id,
          name: p.name || "User",
          age: p.age || null,
          photo: (p.photos || [])[0] || "",
          interestedIn: p.interestedIn || "",
        },
        last: g.last,
        lastAt: g.lastAt,
      };
    });
    res.json({ conversations: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "conversations failed" });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

// Connect to Mongo and start server
client
  .connect()
  .then(async () => {
    db = client.db(MONGODB_DB);
    Users = db.collection("users");
    Likes = db.collection("likes");
    Messages = db.collection("messages");
    await Messages.createIndex({ convoId: 1, createdAt: 1 });
    await Likes.createIndex({ likerId: 1, likedId: 1 }, { unique: true });
    // Socket.IO setup (after DB ready)
    const { Server } = await import("socket.io");
    io = new Server(server, { cors: { origin: true } });
    const socketsByUser = new Map(); // userId -> Set<socket>

    function convoIdFor(a, b) {
      const x = String(a);
      const y = String(b);
      return [x, y].sort().join(":");
    }

    io.on("connection", (socket) => {
      let authedUserId = null;

      socket.on("auth", async ({ userId }) => {
        try {
          if (!userId) return socket.disconnect(true);
          const u = await getUserById(userId);
          if (!u) return socket.disconnect(true);
          authedUserId = userId;
          if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
          socketsByUser.get(userId).add(socket);
          socket.emit("auth:ok");
        } catch {
          socket.disconnect(true);
        }
      });

      socket.on("chat:send", async ({ to, text }) => {
        try {
          if (!authedUserId) return;
          if (!to || typeof text !== "string") return;
          const clean = text.slice(0, 1000);
          const convoId = convoIdFor(authedUserId, to);
          const doc = {
            convoId,
            from: authedUserId,
            to,
            text: clean,
            createdAt: new Date(),
          };
          await Messages.insertOne(doc);
          const payload = { ...doc, id: doc._id?.toString?.() };
          // Echo to sender
          socket.emit("chat:message", payload);
          // Deliver to recipient
          const recSockets = socketsByUser.get(String(to));
          if (recSockets)
            recSockets.forEach((s) => s.emit("chat:message", payload));
        } catch {}
      });

      socket.on("disconnect", () => {
        if (authedUserId && socketsByUser.has(authedUserId)) {
          const set = socketsByUser.get(authedUserId);
          set.delete(socket);
          if (set.size === 0) socketsByUser.delete(authedUserId);
        }
      });
    });

    server.listen(PORT, () => {
      console.log(`sayYes server running http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
