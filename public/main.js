const state = {
  user: null,
  currentStep: "welcome",
  candidates: [],
  idx: 0,
  tempPhotos: [],
  permissions: { audio: false, video: false, motion: false },
  audioContext: null,
};

function saveUser(u) {
  try {
    localStorage.setItem("sayyes_user", JSON.stringify(u));
  } catch {}
}
function loadUser() {
  try {
    return JSON.parse(localStorage.getItem("sayyes_user") || "null");
  } catch {
    return null;
  }
}
function clearUser() {
  try {
    localStorage.removeItem("sayyes_user");
  } catch {}
}

const PROMPT = `A cinematic portrait of a young man in soft golden hour lighting, wearing a relaxed open-collar shirt. The expression — thoughtful yet inviting. Subtle bokeh lights in the background hint at evening city life, evoking anticipation before a first date.`;

// Minimal client logger that also posts to backend for visibility
async function logClient(level, message, data) {
  try {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      `[client:${level}] ${message}`,
      data || ""
    );
    await fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message, data }),
    });
  } catch {}
}

function showLoading(text = "Working...") {
  const node = el(
    `<div class="container"><div class="card center"><div class="big">${text}</div><div style="margin-top:8px">Please wait…</div></div></div>`
  );
  render(node);
}

async function requestPermissionsUI() {
  const ui = el(`
    <div class="intro-wrap">
      <div class="intro-card">
        <div class="intro-head">
          <div class="logo-heart"><span>❤</span></div>
          <div class="intro-title">Before we begin</div>
        </div>
        <div class="perm-sub">We need your permission to use:</div>
        <ul class="perm-list">
          <li class="perm-item"><div class="icon">🎤</div><div>Microphone for voice</div></li>
          <li class="perm-item"><div class="icon">📷</div><div>Camera for your profile photo</div></li>
          <li class="perm-item"><div class="icon">📱</div><div>Motion sensors for nod/shake gestures (optional)</div></li>
        </ul>
        <button class="btn-primary" id="grant">Grant permissions</button>
        <div id="status" style="margin-top:12px;color:#b2f5ea"></div>
      </div>
    </div>
  `);
  render(ui);

  return new Promise((resolve) => {
    const handleGrant = async () => {
      const status = ui.querySelector("#status");
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        state.permissions.audio = true;
        status.innerText = "Microphone access granted";
      } catch (e) {
        status.innerText = "Microphone access denied or unavailable";
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
        state.permissions.video = true;
        status.innerText += "\nCamera access granted";
      } catch (e) {
        status.innerText += "\nCamera access denied or unavailable";
      }
      try {
        if (
          typeof DeviceMotionEvent !== "undefined" &&
          typeof DeviceMotionEvent.requestPermission === "function"
        ) {
          const r = await DeviceMotionEvent.requestPermission();
          state.permissions.motion = r === "granted";
        } else {
          state.permissions.motion = true;
        }
        status.innerText += "\nMotion access handled";
      } catch (e) {
        status.innerText += "\nMotion access denied or unavailable";
      }
      resolve({ ...state.permissions });
    };

    ui.querySelector("#grant").onclick = handleGrant;

    // Voice path: allow "grant permission(s)" or "allow" to trigger
    (async () => {
      await speak('Say "grant permissions" to continue, or tap the button.');
      const ok = await waitForCommand(
        ["grant permission", "grant permissions", "allow", "let's go"],
        { retries: 5 }
      );
      if (ok) handleGrant();
    })();
  });
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function extractEmail(text = "") {
  const match = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].replace(/[.,;:!?]$/, "") : "";
}

function extractPhone(text = "") {
  const digits = String(text).replace(/\D+/g, "");
  // accept 10-15 digits
  if (digits.length < 10 || digits.length > 15) return "";
  return digits; // store raw digits; formatting can be added later
}

async function askEmail() {
  while (true) {
    const reply = (
      await ask("What email should matches contact you at?")
    )?.trim();
    if (reply) return reply;
    await speak("Please say your email.");
  }
}

async function askPhone() {
  while (true) {
    const reply = (
      await ask("What phone number should matches contact you at?")
    )?.trim();
    if (reply) return reply;
    await speak("Please say your phone number.");
  }
}

// Voice command helper: listen and resolve true if any phrase is detected
async function waitForCommand(phrases = [], { retries = 3 } = {}) {
  const norm = phrases.map((p) => p.toLowerCase());
  for (let i = 0; i < retries; i++) {
    try {
      const text = (await recordOnce({ silenceMs: 900 }))?.toLowerCase() || "";
      if (norm.some((p) => text.includes(p))) return true;
    } catch (e) {
      // Likely blocked mic permission; prompt user and retry
      try {
        await speak("Please allow microphone access, or tap the button.");
      } catch {}
    }
  }
  return false;
}

let speakChain = Promise.resolve();
async function speak(text) {
  // Queue TTS so prompts never overlap
  speakChain = speakChain.then(async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn("TTS failed");
      return;
    }
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise((resolve) => {
      audio.addEventListener("ended", resolve, { once: true });
      audio.play().catch(resolve);
    });
  });
  return speakChain;
}

async function recordOnce({ silenceMs = 1200, maxMs = 8000 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const chunks = [];
  let lastSound = Date.now();

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let stopped = false;
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    mediaRecorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.onstop = () => {};
  mediaRecorder.start();

  function monitor() {
    analyser.getByteFrequencyData(data);
    const vol = data.reduce((a, b) => a + b, 0) / data.length;
    if (vol > 15) lastSound = Date.now();
    if (Date.now() - lastSound > silenceMs) stopAll();

    if (Date.now() - (lastSound - silenceMs) > maxMs) stopAll();
    if (!stopped) requestAnimationFrame(monitor);
  }
  monitor();

  await new Promise((r) => (mediaRecorder.onstop = r));
  const blob = new Blob(chunks, { type: "audio/webm" });
  // Convert webm to wav using WebAudio rendering is heavy; we'll rely on Deepgram supporting webm/ogg
  const fd = new FormData();
  fd.append("audio", blob, "input.webm");
  try {
    const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
    if (!sttRes.ok) return "";
    const { text } = await sttRes.json();
    return text?.trim();
  } catch (e) {
    await logClient("error", "STT request failed", String(e));
    return "";
  }
}

function normalizeYesNo(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const yesWords = [
    "yes",
    "yeah",
    "yup",
    "yep",
    "sure",
    "ok",
    "okay",
    "affirmative",
    "do it",
    "go ahead",
  ];
  const noWords = ["no", "nope", "nah", "na", "hell nah", "negative", "stop"];
  if (yesWords.some((w) => t.includes(w))) return true;
  if (noWords.some((w) => t.includes(w))) return false;
  return null;
}

function choiceUI(title, options) {
  const html = `
    <div class="prompt-card">
      <div class="prompt-title">${title}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        ${options
          .map(
            (o) =>
              `<button class="pill" data-v="${o.value}">${o.label}</button>`
          )
          .join("")}
      </div>
      <div class="listen-row"><div class="mic">🎤</div><div>Say your choice or tap a button</div></div>
    </div>`;
  const node = el(html);
  render(node);
  return new Promise(async (resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
    };

    node
      .querySelectorAll(".pill")
      .forEach((b) =>
        b.addEventListener("click", () => finish(b.getAttribute("data-v")))
      );

    const sayOptions = options.map((o) => o.label).join(", ");
    await speak(`${title}. You can tap a button or say: ${sayOptions}.`);

    const lowerLabels = options.map((o) => o.label.toLowerCase());
    const valByLabel = new Map(
      options.map((o) => [o.label.toLowerCase(), o.value])
    );

    // Synonym maps for common prompts
    const isGender = /gender/i.test(title);
    const isInterest = /interested/i.test(title);

    let attempts = 0;
    while (!done) {
      const t = (await recordOnce({ silenceMs: 1100 }))?.toLowerCase() || "";
      // Direct label match
      const direct = lowerLabels.find((lbl) => t.includes(lbl));
      if (direct) return finish(valByLabel.get(direct));

      // Synonyms
      if (isGender) {
        if (/(^|\b)male|man|guy(\b|$)/.test(t)) return finish("male");
        if (/(^|\b)female|woman|girl(\b|$)/.test(t)) return finish("female");
        if (/non\s*-?binary|nonbinary/.test(t)) return finish("non-binary");
      }
      if (isInterest) {
        if (/(women|girls|ladies)/.test(t)) return finish("women");
        if (/(men|guys|boys)/.test(t)) return finish("men");
        if (/(everyone|both|anyone|all)/.test(t)) return finish("everyone");
      }

      attempts++;
      if (attempts % 2 === 0 && !done) {
        await speak(`Please say: ${sayOptions}.`);
      }
    }
  });
}

async function reviewAndConfirm(profile) {
  const form = el(`
    <form class="prompt-card">
      <div class="prompt-title">Review your details</div>
      <div style="margin-top:10px">
        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;row-gap:10px;margin-bottom:12px">
          <div style="opacity:.7">Name</div><div>${profile.name || ""}</div>
          <div style="opacity:.7">Age</div><div>${profile.age || ""}</div>
          <div style="opacity:.7">Email</div><div>${profile.email || ""}</div>
          <div style="opacity:.7">Phone</div><div>${profile.phone || ""}</div>
          <div style="opacity:.7">Gender</div><div>${profile.gender || ""}</div>
          <div style="opacity:.7">Interested in</div><div>${
            profile.interestedIn || ""
          }</div>
          <div style="opacity:.7">Bio</div><div>${profile.bio || ""}</div>
        </div>
      </div>
      <div style="display:grid;gap:10px;margin-top:12px">
        <input id="name" placeholder="Name" value="${profile.name || ""}" />
        <input id="age" type="number" min="18" placeholder="Age" value="${
          profile.age || ""
        }" />
        <input id="email" placeholder="Email" value="${profile.email || ""}" />
        <input id="phone" placeholder="Phone" value="${profile.phone || ""}" />
        <input id="gender" placeholder="Gender" value="${
          profile.gender || ""
        }" />
        <input id="interestedIn" placeholder="Interested in" value="${
          profile.interestedIn || ""
        }" />
        <textarea id="bio" placeholder="Bio" rows="3">${
          profile.bio || ""
        }</textarea>
        <button class="btn-primary" type="button" id="save">Looks good</button>
        <div id="rev-status" style="margin-top:8px;color:#b2f5ea"></div>
      </div>
    </form>`);
  render(form);
  return new Promise(async (resolve) => {
    const save = () => {
      const status = form.querySelector("#rev-status");
      if (status) status.textContent = "Saving...";
      resolve({
        name: form.querySelector("#name").value.trim(),
        age: Number(form.querySelector("#age").value),
        email: form.querySelector("#email").value.trim(),
        phone: form.querySelector("#phone").value.trim(),
        gender: form.querySelector("#gender").value.trim(),
        interestedIn: form.querySelector("#interestedIn").value.trim(),
        bio: form.querySelector("#bio").value.trim(),
      });
    };
    form.querySelector("#save").onclick = save;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      save();
    });
    await speak("Review your details. Say save if everything looks good.");
    const ok = await waitForCommand(["save", "looks good", "continue"], {
      retries: 3,
    });
    if (ok) save();
  });
}

async function ask(question) {
  render(
    el(
      `<div class="prompt-card">
         <div class="prompt-title">${question}</div>
         <div class="listen-row"><div class="mic">🎤</div><div>Listening <span class="voice-dot"></span></div></div>
       </div>`
    )
  );
  await speak(question);
  const text = await recordOnce();
  return text;
}

async function capturePhoto() {
  return new Promise(async (resolve, reject) => {
    logClient("debug", "[capturePhoto] init");
    const video = el("<video autoplay playsinline></video>");
    const snapBtn = el(
      '<button class="btn-primary" style="margin-top:12px">Take photo</button>'
    );
    const status = el(
      '<div style="margin-top:8px;color:#b2f5ea;font-size:0.9rem"></div>'
    );
    const container = el('<div class="camera-card"></div>');
    container.appendChild(video);
    const actions = el('<div class="camera-actions"></div>');
    actions.appendChild(snapBtn);
    container.appendChild(actions);
    container.appendChild(status);
    render(container);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      video.srcObject = stream;
      status.textContent = "Initializing camera...";
    } catch (e) {
      logClient("error", "[capturePhoto] getUserMedia failed", String(e));
      status.textContent = "Unable to access camera";
      return reject(e);
    }

    async function stopStream() {
      try {
        stream && stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }

    const ready = await new Promise((res) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        res(ok);
      };
      const checkDims = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) finish(true);
        else requestAnimationFrame(checkDims);
      };
      video.onloadedmetadata = async () => {
        try {
          await video.play();
        } catch {}
        checkDims();
      };
      setTimeout(() => finish(false), 6000);
    });
    if (!ready) {
      status.textContent = "Camera did not become ready";
      logClient("warn", "[capturePhoto] video not ready (timeout)");
    } else {
      status.textContent = 'Camera ready — say "take photo" or tap the button.';
      // Voice shutter command
      (async () => {
        await speak('Say "take photo" to snap, or tap the button.');
        const ok = await waitForCommand(
          ["take photo", "snap photo", "take the photo", "capture", "shoot"],
          { retries: 4 }
        );
        if (ok)
          try {
            snapBtn.click();
          } catch {}
      })();
    }

    function canvasFromVideoFrame(v) {
      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const cx = c.getContext("2d");
      cx.drawImage(v, 0, 0, w, h);
      return c;
    }

    snapBtn.onclick = async () => {
      logClient("debug", "[capturePhoto] snap clicked");
      status.textContent = "Capturing...";
      try {
        let canvas;
        const track = stream.getVideoTracks()[0];
        if (window.ImageCapture) {
          try {
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);
          } catch (err) {
            logClient(
              "warn",
              "[capturePhoto] grabFrame failed, falling back",
              String(err)
            );
            canvas = canvasFromVideoFrame(video);
          }
        } else {
          canvas = canvasFromVideoFrame(video);
        }

        const doUpload = async (blob) => {
          try {
            await stopStream();
          } catch {}
          showLoading("Uploading photo...");
          const fd = new FormData();
          fd.append("photo", blob, "photo.jpg");
          logClient("debug", "[capturePhoto] uploading /api/photo");
          const r = await fetch("/api/photo", { method: "POST", body: fd });
          if (!r.ok) {
            const txt = await r.text();
            logClient("error", "[capturePhoto] /api/photo failed", txt);
            throw new Error("upload failed");
          }
          const { url } = await r.json();
          logClient("debug", "[capturePhoto] upload ok", url);
          resolve(url);
        };

        if (!canvas || !canvas.width || !canvas.height) {
          canvas = canvasFromVideoFrame(video);
        }

        let toBlobDone = false;
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              logClient(
                "warn",
                "[capturePhoto] toBlob returned null, using toDataURL"
              );
              const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
              const res = await fetch(dataUrl);
              const buf = await res.blob();
              await doUpload(buf);
            } else {
              await doUpload(blob);
            }
            toBlobDone = true;
          },
          "image/jpeg",
          0.9
        );
        setTimeout(() => {
          if (!toBlobDone) {
            logClient(
              "warn",
              "[capturePhoto] toBlob timeout, using dataURL fallback"
            );
            try {
              const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
              fetch(dataUrl)
                .then((r) => r.blob())
                .then(doUpload);
            } catch (e) {
              logClient(
                "error",
                "[capturePhoto] dataURL fallback failed",
                String(e)
              );
            }
          }
        }, 3000);
      } catch (e) {
        logClient("error", "[capturePhoto] error", String(e));
        status.textContent = "Capture failed";
        await stopStream();
        reject(e);
      }
    };
  });
}

function render(node) {
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.appendChild(node);
}

async function onboarding() {
  // Ask for permissions up front
  await requestPermissionsUI();

  // Welcome
  const welcome = `Welcome to sayYes`;
  render(
    el(
      `<div class="intro-wrap">
         <div class="intro-card center">
           <div class="intro-head" style="justify-content:center">
             <div class="logo-heart"><span>❤</span></div>
             <div class="intro-title">${welcome}</div>
           </div>
           <div class="perm-sub" style="text-align:center;margin-top:10px">Voice-first dating. Swipe with your voice or tap.</div>
         </div>
       </div>`
    )
  );
  await speak(
    "Welcome to sayYes. Voice-first dating. Swipe with your voice or tap."
  );

  // Name (voice prompt and listen)
  let name;
  while (!name) {
    const txt = await ask("What’s your name?");
    name = txt;
  }

  // Age
  let age;
  while (!age) {
    const txt = await ask("What’s your age?");
    const n = parseInt(txt?.match(/\d+/)?.[0]);
    if (n && n >= 18) age = n;
    else await speak("Please say an age 18 or older.");
  }

  // Gender and interest (Tinder-style)
  const gender = await choiceUI("What is your gender?", [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
    { label: "Non-binary", value: "non-binary" },
  ]);
  const interestedIn = await choiceUI("Who are you interested in?", [
    { label: "Women", value: "women" },
    { label: "Men", value: "men" },
    { label: "Everyone", value: "everyone" },
  ]);

  // Bio
  const bio = await ask("Give me a short bio about you.");

  // Email
  const email = await askEmail();

  // Phone
  const phone = await askPhone();

  // Photos: capture one, generate up to 4 variants with Nano Banana
  let photos = [];
  while (true) {
    await speak("Say yes to take your photo now, or no to skip.");
    const confirm = await waitForYesNo();
    if (confirm === false) break;
    if (confirm === true) {
      const photoUrl = await capturePhoto();
      await speak("Nice! Generating some date-ready portraits for you.");
      showLoading();
      let genPhotos = [];
      try {
        const gen = await fetch("/api/generate-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: PROMPT,
            input_image_url: photoUrl,
            num: 4,
          }),
        });
        const j = await gen.json();
        genPhotos = (j.photos || []).slice(0, 4);
      } catch (e) {
        await speak(
          "I had trouble generating photos. We can continue without them."
        );
      }

      if (!genPhotos.length) {
        await speak(
          "No generated photos were returned. We will skip this step."
        );
        break;
      }

      for (let i = 0; i < genPhotos.length; i++) {
        const p = genPhotos[i];
        render(
          el(
            `<div class="gen-card">
               <img src="${p}"/>
               <div class="large" style="margin-top:12px">Image ${i + 1} of ${
              genPhotos.length
            }</div>
               <div class="gen-actions">
                 <button class="pill pill-no" id="skip">Skip</button>
                 <button class="pill pill-yes" id="keep">Keep</button>
               </div>
             </div>`
          )
        );
        await speak(
          `Image ${i + 1} of ${
            genPhotos.length
          }. Say yes to keep, or no to skip.`
        );
        const ans = normalizeYesNo(await recordOnce());
        if (ans) photos.push(p);
        const skipBtn = document.getElementById("skip");
        const keepBtn = document.getElementById("keep");
        if (skipBtn && keepBtn) {
          skipBtn.onclick = () => {};
          keepBtn.onclick = () => {
            photos.push(p);
          };
        }
      }
      break;
    }
  }

  // Review and confirm (always wait)
  while (true) {
    const reviewed = await reviewAndConfirm({
      name,
      age,
      bio,
      email,
      phone,
      gender,
      interestedIn,
    });
    name = reviewed.name || name;
    age = reviewed.age || age;
    const finalGender = reviewed.gender || gender;
    const finalInterestedIn = reviewed.interestedIn || interestedIn;
    const final = {
      name,
      age,
      bio: reviewed.bio || bio,
      email: reviewed.email || email,
      phone: reviewed.phone || phone,
      gender: finalGender,
      interestedIn: finalInterestedIn,
      photos,
    };

    if (!final.name || !final.age) {
      await speak("Please provide your name and age.");
      continue;
    }

    try {
      const saveRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(final),
      });
      if (!saveRes.ok) {
        const txt = await saveRes.text();
        await speak("Saving failed. Please review and try again.");
        console.error("onboarding save failed", txt);
        continue;
      }
      const { user } = await saveRes.json();
      state.user = user;
      saveUser(user);
      break;
    } catch (e) {
      await speak("Network error while saving. Please try again.");
      continue;
    }
  }

  await speak("Registration complete! Congratulations!");
  confetti();
  await speak(
    `We’re all setup, now let’s find you a sweet date, ${state.user.name}! Say yes to like or no to pass. Ok, let’s go.`
  );
  await browse();
}

async function loadCandidates() {
  const r = await fetch(
    `/api/candidates?userId=${encodeURIComponent(String(state.user.id))}`
  );
  const { candidates } = await r.json();
  state.candidates = candidates;
  state.idx = 0;
}

function currentCandidate() {
  return state.candidates[state.idx];
}

async function getMotionPermission() {
  try {
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      const res = await DeviceMotionEvent.requestPermission();
      return res === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

function waitForGesture() {
  return new Promise(async (resolve) => {
    const permission = await getMotionPermission();
    if (!permission) {
      resolve(null);
      return;
    }
    let resolved = false;
    let last = { beta: null, gamma: null };
    let nodScore = 0,
      shakeScore = 0;

    const onOrient = (e) => {
      if (resolved) return;
      const beta = e.beta || 0; // front-back tilt (nod)
      const gamma = e.gamma || 0; // left-right tilt (shake)
      if (last.beta !== null) nodScore += Math.abs(beta - last.beta);
      if (last.gamma !== null) shakeScore += Math.abs(gamma - last.gamma);
      last = { beta, gamma };
      if (nodScore > 60) {
        resolved = true;
        cleanup();
        resolve(true);
      } // nod yes
      if (shakeScore > 60) {
        resolved = true;
        cleanup();
        resolve(false);
      } // shake no
    };
    const cleanup = () => {
      window.removeEventListener("deviceorientation", onOrient);
    };
    window.addEventListener("deviceorientation", onOrient);
    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(null);
      }
    }, 7000);
  });
}

// Simplify: voice-only yes/no, and if unclear, ask once more clearly
async function waitForYesNo(shouldCancel) {
  if (typeof shouldCancel === "function" && shouldCancel()) return null;
  let first = normalizeYesNo(await recordOnce({ silenceMs: 900 }));
  if (typeof shouldCancel === "function" && shouldCancel()) return null;
  if (first !== null) return first;
  await speak("Please say clearly: yes or no.");
  if (typeof shouldCancel === "function" && shouldCancel()) return null;
  let second = normalizeYesNo(await recordOnce({ silenceMs: 900 }));
  if (typeof shouldCancel === "function" && shouldCancel()) return null;
  if (second !== null) return second;
  return null;
}

async function submitLike(liked, candidate) {
  try {
    const userId = (state.user && (state.user.id || state.user._id)) || null;
    const targetId = (candidate && (candidate.id || candidate._id)) || null;
    if (!userId || !targetId) {
      console.error("submitLike missing ids", {
        userId,
        targetId,
        user: state.user,
        candidate,
      });
      alert("Unable to like right now. Missing IDs.");
      // Advance to avoid dead-end but log the issue
      state.idx += 1;
      await showCandidate();
      return;
    }

    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        targetId,
        liked,
      }),
    });

    if (!res.ok) {
      console.error("Like submission failed:", res.status);
      // Still advance to keep flow moving
      state.idx += 1;
      await showCandidate();
      return;
    }

    const result = await res.json();

    if (result.match) {
      await showMatch(result.match);
      return;
    }

    state.idx += 1;
    await showCandidate();
  } catch (e) {
    console.error("submitLike error:", e);
    state.idx += 1;
    await showCandidate();
  }
}

async function showCandidate() {
  const c = currentCandidate();
  if (!c) {
    render(
      el(`
        <div class="container">
          <div class="prompt-card center" style="text-align:center;padding:28px 22px">
            <div class="prompt-title" style="margin-bottom:8px">All caught up!</div>
            <div class="large" style="opacity:.9">Looks like you’ve seen everyone for now.</div>
            <div style="margin-top:16px">
              <button class="btn" id="back-end">Back</button>
            </div>
          </div>
        </div>
      `)
    );
    await speak("All caught up. Looks like you’ve seen everyone for now.");
    const backBtn = document.getElementById("back-end");
    if (backBtn)
      backBtn.onclick = async () => {
        // Go back to a neutral screen
        render(
          el(
            '<div class="container"><div class="card center">Say yes to begin browsing again later.</div></div>'
          )
        );
      };
    return;
  }
  const photos = c.photos || [];
  const mainPhoto = photos[0] || "/assets/placeholder.jpeg";

  const ui = el(`
    <div class="container">
      <div class="stack">
        <div class="t-card" id="tcard">
          <div class="bg" style="background-image:url('${mainPhoto}')"></div>
          <div class="swipe-label swipe-like" id="likeLabel">LIKE</div>
          <div class="swipe-label swipe-nope" id="nopeLabel">NOPE</div>
          <div class="t-info">
            <div class="t-name">${c.name}, ${c.age}</div>
            <div class="t-bio">${c.bio || ""}</div>
            <div class="badges">
              ${c.email ? `<div class="badge">${c.email}</div>` : ""}
              ${c.phone ? `<div class="badge">${c.phone}</div>` : ""}
      </div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="action-btn btn-no" id="btn-no">✖</button>
        <button class="action-btn btn-yes" id="btn-yes">❤</button>
      </div>
      <div class="card center" style="background:transparent;border:none;box-shadow:none;margin-top:8px">
        <div class="large">Say yes to like (or tap ❤), or no to pass (or tap ✖).</div>
        <div style="margin-top:8px">Listening <span class="voice-dot"></span></div>
      </div>
    </div>
  `);
  render(ui);

  const tcard = ui.querySelector("#tcard");
  const likeLabel = ui.querySelector("#likeLabel");
  const nopeLabel = ui.querySelector("#nopeLabel");

  let decided = false;
  const decide = (liked) => {
    if (decided) return;
    decided = true;
    settle(liked);
  };

  // Drag to swipe
  let startX = 0,
    startY = 0,
    dragging = false;
  const onPointerDown = (e) => {
    dragging = true;
    startX = e.clientX || e.touches?.[0]?.clientX || 0;
    startY = e.clientY || e.touches?.[0]?.clientY || 0;
    tcard.setPointerCapture && tcard.setPointerCapture(e.pointerId || 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true, once: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp, { passive: true, once: true });
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - startX;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - startY;
    const rot = x / 20;
    tcard.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    const likeO = Math.max(0, Math.min(1, (x - 30) / 120));
    const nopeO = Math.max(0, Math.min(1, (-x - 30) / 120));
    likeLabel.style.opacity = String(likeO);
    nopeLabel.style.opacity = String(nopeO);
  };
  const cleanupDrag = () => {
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("touchmove", onMove);
  };
  const settle = async (liked) => {
    cleanupDrag();
    // disable buttons during animation
    const yesBtn = document.getElementById("btn-yes");
    const noBtn = document.getElementById("btn-no");
    if (yesBtn) yesBtn.disabled = true;
    if (noBtn) noBtn.disabled = true;
    tcard.style.willChange = "transform, opacity";
    tcard.style.transition = "transform 220ms ease, opacity 220ms ease";
    const off = (window.innerWidth || 800) * 1.2;
    tcard.style.transform = liked
      ? `translate(${off}px, -30px) rotate(15deg)`
      : `translate(${-off}px, -30px) rotate(-15deg)`;
    tcard.style.opacity = liked ? "1" : ".85";
    await new Promise((r) => setTimeout(r, 230));
    await submitLike(liked, c);
  };
  const onUp = async (e) => {
    if (!dragging) return;
    cleanupDrag();
    const matrix = new WebKitCSSMatrix(getComputedStyle(tcard).transform);
    const x = matrix.m41;
    if (x > 110) return decide(true);
    if (x < -110) return decide(false);
    // snap back
    tcard.style.transition = "transform 180ms ease";
    tcard.style.transform = "translate(0,0) rotate(0deg)";
    likeLabel.style.opacity = "0";
    nopeLabel.style.opacity = "0";
  };
  tcard.addEventListener("pointerdown", onPointerDown);
  tcard.addEventListener("touchstart", onPointerDown, { passive: true });

  // Buttons
  ui.querySelector("#btn-yes").onclick = () => decide(true);
  ui.querySelector("#btn-no").onclick = () => decide(false);

  // Voice prompt then listen, but skip if a decision is already made
  await speak("Say yes to like, or no to pass.");
  if (decided) return;
  const resp = await waitForYesNo(() => decided);
  if (decided) return; // user tapped or swiped during listening
  if (resp === null) {
    if (decided) return;
    return showCandidate();
  }
  decide(!!resp);
}

// Chat home list (Instagram-like)
let chatHomeOpen = false;
async function openChatHome() {
  chatHomeOpen = true;
  ensureSocket();
  const me = state.user && (state.user.id || state.user._id);
  const ui = el(`
    <div class="container">
      <div class="card" style="display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:2">
        <button class="btn" id="home-back">Back</button>
        <div style="font-weight:700">Chats</div>
      </div>
      <div id="conv-list" class="card" style="padding:0;margin-top:8px"></div>
    </div>
  `);
  render(ui);
  const list = ui.querySelector("#conv-list");

  async function load() {
    list.innerHTML = "";
    try {
      const res = await fetch(
        `/api/conversations?userId=${encodeURIComponent(me)}`
      );
      if (res.ok) {
        const { conversations } = await res.json();
        if (!conversations.length) {
          list.appendChild(
            el(
              '<div style="padding:16px;opacity:.8">No conversations yet.</div>'
            )
          );
        }
        conversations.forEach((c) => {
          const row = el(`
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer">
              <div style="width:44px;height:44px;border-radius:50%;background:#333;background-size:cover;background-position:center;background-image:url('${
                c.user.photo || ""
              }')"></div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${
                    c.user.name
                  }</div>
                  <div style="opacity:.6;font-size:.85rem">${new Date(
                    c.lastAt
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</div>
                </div>
                <div style="opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${
                  c.last || ""
                }</div>
              </div>
            </div>
          `);
          row.onclick = () =>
            openChatPage({
              id: c.user.id,
              name: c.user.name,
              age: c.user.age,
              photos: c.user.photo ? [c.user.photo] : [],
              interestedIn: c.user.interestedIn,
            });
          list.appendChild(row);
        });
      }
    } catch {}
  }
  await load();

  const back = ui.querySelector("#home-back");
  back.onclick = async () => {
    chatHomeOpen = false;
    await showCandidate();
  };

  // Live refresh on incoming messages
  const sock = ensureSocket();
  const refresh = () => {
    if (chatHomeOpen) load();
  };
  sock.off && sock.off("chat:message", refresh);
  sock.on("chat:message", refresh);
}

async function showMatch(match) {
  const me = match.me,
    them = match.them;
  const interests = them.interestedIn || "";
  render(
    el(`
    <div class="container">
      <div class="prompt-card center" style="text-align:center">
        <div class="prompt-title">It’s a match! 🎉</div>
        <div class="large" style="margin-top:8px">You and ${
          them.name
        } like each other.</div>
      </div>
      <div class="stack" style="height:auto">
        <div class="t-card" style="position:relative; inset:auto; max-height:420px">
          <div class="bg" style="background-image:url('${
            (them.photos || [])[0] || ""
          }')"></div>
          <div class="t-info">
            <div class="t-name">${them.name}, ${them.age}</div>
            <div class="t-bio">${them.bio || ""}</div>
            <div class="badges">
              ${
                interests
                  ? `<div class="badge">Interested in: ${interests}</div>`
                  : ""
              }
              ${them.email ? `<div class="badge">${them.email}</div>` : ""}
              ${them.phone ? `<div class="badge">${them.phone}</div>` : ""}
      </div>
      </div>
        </div>
      </div>
      <div class="actions" style="margin-top:12px;justify-content:center;gap:12px">
        <button class="action-btn btn-yes" id="chat">Chat</button>
        <button class="action-btn btn-no" id="back">Back</button>
      </div>
    </div>
  `)
  );
  await speak(`It’s a match! You and ${them.name} like each other.`);
  const back = document.getElementById("back");
  if (back)
    back.onclick = async () => {
      state.idx += 1;
      await showCandidate();
    };
  const chat = document.getElementById("chat");
  if (chat)
    chat.onclick = async () => {
      await openChatPage(them);
    };
}

async function browse() {
  await loadCandidates();
  await showCandidate();
}

// Socket client and chat UI
let socket = null;
let socketAuthed = false;
function ensureSocket() {
  const uid = state.user && (state.user.id || state.user._id);
  if (socket) {
    // Ensure auth even if already connected
    if (socket.connected && uid && !socketAuthed)
      socket.emit("auth", { userId: uid });
    return socket;
  }
  // socket.io client is loaded via /socket.io/socket.io.js
  // @ts-ignore
  socket = window.io();
  socket.on("connect", () => {
    const idNow = state.user && (state.user.id || state.user._id);
    if (idNow) socket.emit("auth", { userId: idNow });
  });
  socket.on("auth:ok", () => {
    socketAuthed = true;
  });
  socket.on("chat:message", (msg) => {
    // If chat is open with this partner, append; else show a toast
    const me = state.user && (state.user.id || state.user._id);
    if (currentChat) {
      const themId = currentChat.id || currentChat._id;
      const isBetweenUs =
        (msg.from === me && msg.to === themId) ||
        (msg.from === themId && msg.to === me);
      if (isBetweenUs) {
        appendChatMessage(msg, msg.from === me);
        return;
      }
    }
    showToast(
      `${msg.from === (state.user.id || state.user._id) ? "You" : "New message"}: ${msg.text.slice(0, 60)}`
    );
  });
  return socket;
}

let currentChat = null;
function showToast(text) {
  const n = el(
    `<div class="card" style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999">${text}</div>`
  );
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2200);
}

function appendChatMessage(msg, mine) {
  const list = document.getElementById("chat-list");
  if (!list) return;
  const item = el(`<div style="display:flex;justify-content:${
    mine ? "flex-end" : "flex-start"
  };margin:6px 0">
    <div style="max-width:70%;padding:8px 10px;border-radius:12px;${
      mine ? "background:#ff6ea8;color:white;" : "background:#222;color:#eee;"
    }">${msg.text}</div>
  </div>`);
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}

async function openChatOverlay(them) {
  currentChat = them;
  ensureSocket();
  const overlay = el(`
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9998">
      <div class="prompt-card" style="width:min(560px,92vw);max-height:80vh;display:flex;flex-direction:column">
        <div class="prompt-title">Chat with ${them.name}</div>
        <div id="chat-list" style="flex:1;overflow:auto;margin-top:8px;padding-right:4px"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input id="chat-input" placeholder="Type a message" style="flex:1" />
          <button class="btn-primary" id="chat-send">Send</button>
          <button class="btn" id="chat-close">Back</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);

  // Load history
  try {
    const uid = state.user && (state.user.id || state.user._id);
    const res = await fetch(
      `/api/messages?userId=${encodeURIComponent(
        uid
      )}&otherId=${encodeURIComponent(them.id || them._id)}`
    );
    if (res.ok) {
      const { messages } = await res.json();
      messages.forEach((m) => appendChatMessage(m, m.from === uid));
    }
  } catch {}

  const sendBtn = overlay.querySelector("#chat-send");
  const input = overlay.querySelector("#chat-input");
  const closeBtn = overlay.querySelector("#chat-close");

  const doSend = () => {
    const text = String(input.value || "").trim();
    if (!text) return;
    const sock = ensureSocket();
    const to = them.id || them._id;
    const uid = state.user && (state.user.id || state.user._id);
    // Send; rely on server echo to render (avoids duplicates)
    sock.emit("chat:send", { to, text: text.slice(0, 1000) });
    input.value = "";
  };
  sendBtn.onclick = doSend;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
  });
  closeBtn.onclick = () => {
    overlay.remove();
    currentChat = null;
  };
}

// Full-screen chat page (Instagram-like)
async function openChatPage(them) {
  currentChat = them;
  ensureSocket();
  const headerPhoto = (them.photos || [])[0] || "";
  const ui = el(`
    <div class="container">
      <div class="card" style="display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:2">
        <button class="btn" id="chat-back">Back</button>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background-size:cover;background-position:center;background-image:url('${headerPhoto}')"></div>
          <div style="display:flex;flex-direction:column;line-height:1.2">
            <div style="font-weight:600">${them.name}${
    them.age ? ", " + them.age : ""
  }</div>
            <div style="opacity:.8;font-size:.9rem">${
              them.interestedIn
                ? "Interested in: " + them.interestedIn
                : "Match"
            }</div>
          </div>
        </div>
      </div>
      <div id="chat-list" class="card" style="height:58vh;overflow:auto;margin-top:8px"></div>
      <div class="card" style="display:flex;gap:8px;margin-top:8px;position:sticky;bottom:0">
        <input id="chat-input" placeholder="Message" style="flex:1" />
        <button class="btn-primary" id="chat-send">Send</button>
      </div>
    </div>
  `);
  render(ui);

  // Load history
  try {
    const uid = state.user && (state.user.id || state.user._id);
    const res = await fetch(
      `/api/messages?userId=${encodeURIComponent(
        uid
      )}&otherId=${encodeURIComponent(them.id || them._id)}`
    );
    if (res.ok) {
      const { messages } = await res.json();
      messages.forEach((m) => appendChatMessage(m, m.from === uid));
    }
  } catch {}

  const sendBtn = ui.querySelector("#chat-send");
  const input = ui.querySelector("#chat-input");
  const back = ui.querySelector("#chat-back");

  const doSend = () => {
    const text = String(input.value || "").trim();
    if (!text) return;
    const sock = ensureSocket();
    const to = them.id || them._id;
    sock.emit("chat:send", { to, text: text.slice(0, 1000) });
    input.value = "";
  };
  sendBtn.onclick = doSend;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
  });
  back.onclick = async () => {
    currentChat = null;
    await showCandidate();
  };
}

// Start with persisted session if present
async function init() {
  const stored = loadUser();
  if (stored && stored.id) {
    state.user = stored;
    await speak(`Welcome back, ${stored.name || "there"}.`);
    await browse();
  } else {
    await onboarding();
  }
}

init();

// Simple confetti (fallback minimal)
function confetti() {
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const N = 120;
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * w,
    y: -Math.random() * h,
    r: 4 + Math.random() * 6,
    c: `hsl(${Math.random() * 360}, 90%, 60%)`,
    v: 2 + Math.random() * 4,
  }));
  let frames = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.v;
      p.x += Math.sin(p.y / 20);
      if (p.y > h + 20) p.y = -20;
    }
    frames++;
    if (frames < 400) requestAnimationFrame(draw);
    else setTimeout(() => canvas.remove(), 1000);
  }
  draw();
}
