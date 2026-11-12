# Gemini prompts for the Clinch demo video

Use **Google AI Studio** (https://aistudio.google.com) and the newest **Gemini Pro** model. It accepts several
video files in one prompt.

Order of work:
1. Record the clips (SHOOT.md).
2. Run `.\render.ps1`. It copies your recordings into `public\clips` as C01.mp4... and prints their lengths.
3. **Prompt 1** with the clips: you get the edit plan. Save it as `public\edit.json`.
4. Run `.\render.ps1` again. It writes `out\narration.txt` and stops.
5. **Prompt 2** (speech) with that text: you get the voice-over. Save it as `public\voiceover.wav`.
6. Run `.\render.ps1 -Preview` to check timing (about 1 minute), then `.\render.ps1` for the final video
   (5-10 minutes). The result is `out\clinch-demo.mp4`, plus `out\clinch-demo.srt` for YouTube subtitles.
7. Optional, **Prompt 3**: give Gemini `out\preview.mp4` to fix timing or zooms, then render again.

If Gemini speech fails or is too slow, use `.\render.ps1 -SapiVoice` (Windows voice), or `-NoVoice` (captions only).

---

## Prompt 1: edit plan (attach every clip from `D:\paypal\video\public\clips`)

Paste this, then paste the contents of `out\clips.txt` under it.

```text
You are the editor and script writer for a product demo video. The style is a modern motion-graphics screen
demo, like Remotion or HyperFrames: footage shown inside a floating rounded window, smooth zooms onto the
part of the screen that matters, short callout pills, bold word-by-word captions. My renderer does all the
animation. You only output a JSON edit plan.

PRODUCT: Clinch (https://clinchdeal.in), built for the PayPal AI Hackathon 2026. It's a reverse marketplace
for hard-to-find things. The buyer posts what they need with a photo and a max price. PayPal AUTHORIZES
(holds, not charges) the max price. An AI matchmaker invites the right sellers. Sellers send versioned offers.
Every counter shows a diff. The buyer's AI copilot (gpt-oss-120b on Groq) risk-checks offers and suggests a
counter inside the buyer's private target, which the seller never sees. It only drafts and never sends or
pays. The Clinch Agent is built on PayPal's Agent Toolkit: it reads the live PayPal order for this deal and
cannot move money. Accepting signs the exact offer version (SHA-256 fingerprint), and PayPal captures only
the winning price, releasing the rest of the hold. The seller ships with tracking on the PayPal order. When
the buyer accepts delivery, PayPal Payouts pays the seller minus Clinch's 6% fee, and the money trail shows
every PayPal ID and the fee split. A scam shield flags "pay me on Zelle" and phone numbers in chat. A dispute
pauses the payout. Trust scores come from paid, completed deals. Everything runs on the PayPal sandbox.

STORY IN THE CLIPS: Jordan, a fleet manager at a small machine shop, needs two things: a 6-axis cobot for
machine tending (photo of a white CR605-style arm) and front-end crash repair for a white Audi A3 that hit a
pole (photo). Planned clips, in order (some may be missing or retaken):
C01 home page; C02 Jordan posts the cobot need and AI suggests the category; C03 PayPal holds $4,500;
C04 Jordan posts the Audi repair; C05 PayPal holds $1,500; C06 seller Atlas Alloy Supply offers $4,350 for the
cobot; C07 seller Vintage Volt Parts offers on the Audi, then writes "pay me on Zelle" and the scam shield
flags it; C08 Jordan uses Copilot risk check and suggest counter, counters $3,950, asks the Clinch Agent what
PayPal shows; C09 Atlas sends $4,100 best and final; C10 Jordan accepts, PayPal captures $4,100, agreement
fingerprint; C11 Atlas marks it shipped with UPS tracking; C12 Jordan accepts delivery, PayPal Payouts pays
Atlas, money trail with fees and Seller Protection; C13 Atlas's trust profile.
Watch every clip and trust what you SEE over this plan. Use the real amounts and text shown on screen.

OUTPUT: only one JSON object, no prose, no code fence, with this shape:
{
  "segments": [
    { "type": "card", "kind": "intro", "heading": "...", "sub": "...", "chips": ["...", "..."], "narration": "..." },
    { "type": "clip", "clip": "C02.mp4", "in": 1.2, "out": 38.5,
      "label": "1 · Buyer posts a need",
      "zooms": [ { "at": 0.10, "until": 0.40, "x": 0.50, "y": 0.62, "scale": 1.7 } ],
      "callouts": [ { "at": 0.15, "text": "AI picks the category" } ],
      "narration": "..." },
    { "type": "card", "kind": "outro", "heading": "...", "sub": "...", "chips": ["..."], "narration": "..." }
  ]
}

RULES
- First segment: intro card. heading max 6 words, sub max 12 words, 3-5 chips naming the tech (for example
  PayPal Orders, Payouts, Agent Toolkit, gpt-oss on Groq). Last segment: outro card with heading
  "Try it at clinchdeal.in" and sub "Built for the PayPal AI Hackathon 2026". You may add one
  {"type":"card","kind":"chapter","heading":"..."} between the cobot story and the Audi story if it helps.
- Clip segments: "in" and "out" are seconds in that clip. Cut dead time: page loads, slow typing, my mouse
  wandering. You may use one clip twice with different in/out ranges, and you may drop weak clips.
- "zooms": 0-2 per clip segment. "at" and "until" are FRACTIONS (0-1) of the segment's length, not seconds,
  and must not overlap. x and y are the focal point as fractions of the frame (0,0 = top-left). scale is
  1.3-2.2. Zoom on what the narration is talking about at that moment: the AI category reason, the PayPal
  hold amount, the offer diff chips, the copilot answer, the agent answer, the money trail.
- "callouts": 0-2 per clip, max 5 words each, "at" is a fraction of the segment. Examples: "PayPal holds
  $4,500", "Only the winning price is captured", "Scam shield", "Seller never sees your target".
- "label": the step shown top-left, like "2 · PayPal holds the budget".
- "narration": what the voice-over says during that segment. Speak to judges, present tense, plain words,
  confident, no hype words (no "revolutionary", "seamless", "game-changing"). Say why PayPal matters at each
  money step. Say "AI" only where it really does something on screen.
- The narration is split across segments in proportion to its length, so give each segment narration that
  fits how long its footage should be: long clips get more words, quick clips get one short sentence.
- TOTAL narration across all segments: 340-380 words. That keeps the video at about 2:40-2:50, under 3:00.
- Use only facts from PRODUCT and what you see. Don't invent numbers.
- Output valid JSON only.
```

---

## Prompt 2: voice-over (AI Studio > Generate speech)

Model: the Gemini TTS model. Mode: single speaker. Voice: **Charon** (informative), or **Kore** if you prefer
a lighter voice. Put this in the style instructions box:

```text
Read this as a confident, friendly product demo narrator. Medium pace, about 150 words per minute. Clear and
warm, not salesy. Pause briefly between paragraphs. Say "clinchdeal dot in" for the web address, "PayPal" as
one word, and "gpt-oss" as "G P T oss".
```

Paste the whole text of `out\narration.txt` as the text to speak. Run it, download the audio, and save it as
`D:\paypal\video\public\voiceover.wav`. If it downloads as .mp3 or .m4a, save it as `voiceover.mp3` or
`voiceover.m4a`. The script accepts all three.

If the text is too long for one run, split it in two at a paragraph break. Join the two files in order with
Clipchamp (or ask me), or run `-SapiVoice`.

---

## Prompt 3 (optional): review the preview

Attach `out\preview.mp4` and `public\edit.json` (paste the JSON as text):

```text
This is a rendered preview of my product demo, made from the attached edit plan. Watch it and fix the plan.
Zooms must land on what the voice is talking about, at that moment. Callouts must not cover the important part
of the screen. Captions must match what is on screen. Cut any footage where nothing happens. Keep total
narration at 340-380 words. Return only the corrected JSON, same shape, no prose.
```

Save the answer over `public\edit.json`. Keep `voiceover.wav` only if the narration text did not change;
otherwise redo prompt 2. Then run `.\render.ps1`.
