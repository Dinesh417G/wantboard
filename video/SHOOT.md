# Clinch demo: shoot sheet

You record raw clips (no talking, no music). Gemini writes the narration, subtitles and edit plan. `render.ps1`
cuts the final video with zooms, callouts and captions. Target: 2:45 final, under 3:00.

## Setup (2 min, not recorded)

1. Chrome, maximized, zoom 100% (Ctrl+0), bookmarks bar hidden (Ctrl+Shift+B), all other tabs closed.
2. Windows: notifications off (Win+N, Do not disturb).
3. Open https://clinchdeal.in/login and click **Jordan Ellis** under "Try a demo account". Jordan is the buyer:
   a fleet manager for a small machine shop in Denver.
4. Keep the sandbox buyer password ready.
5. Photos you will pick in the file dialog (they're on your Desktop):
   - `CR605-Cobot-Robot.jpg`
   - `the-front-part-of-the-damaged-car-...jpg`

## Recorders

| Recorder | Keys | Use for | Saves to |
|---|---|---|---|
| **Xbox Game Bar** | `Win+Alt+R` start, `Win+Alt+R` stop | every clip except PayPal | `C:\Users\work\Videos\Captures` |
| **Snipping Tool** | `Win+Shift+R`, drag over the whole screen, Start; stop with the red button | **C03 and C05 only** (the PayPal window is a pop-up and Game Bar can't see it) | `C:\Users\work\Videos\Screen Recordings` |

Rules for every clip:
- Wait 1 second after you start recording and 1 second before you stop.
- Move the mouse slowly and pause about half a second on what matters, because the editor zooms there.
- If you make a mistake, keep going or re-record that clip. The newest take of a clip wins (see "Retakes" below).
- Don't type passwords while recording. Pause, type, then resume (or stop and start a new take).

## Clips

Clip names are assigned in the order you record them. **Record in this order.**

### C01: Home (Game Bar, ~10 s)
Signed in as Jordan. On https://clinchdeal.in, scroll slowly from the hero down to "How it works" and stop.

### C02: Jordan posts a cobot need (Game Bar, ~45 s)
Go to **Post a need** and fill it in, pasting the text:
- Item: `Collaborative robot arm (cobot), 6-axis, 5 kg payload`
- Details: `Need a cobot for machine tending on two CNC lathes. 6-axis, about 5 kg payload, 900 mm reach, like the CR605 in the photo. Refurbished is fine if it comes with the controller, teach pendant and a test video.`
- Click **Add** under photos and pick `CR605-Cobot-Robot.jpg`.
- Click **Suggest with AI** and wait for the category and its reason to appear (pause 2 s on it).
- Preferences (one per line): `Controller and teach pendant included` / `Test video before shipping` / `6-month warranty`
- Needed by: two weeks from today. Max price: `4500`. Private target: `3900`.
- Pause on "Next: PayPal holds your max price", then click **Continue to PayPal**. Stop recording.

### C03: PayPal holds the cobot budget (**Snipping Tool, full screen**, ~25 s)
Click the PayPal button. In the pop-up, log in as the sandbox buyer. Type the password with recording
paused, or accept that it's masked. Approve. Back on Clinch, wait until "PayPal holding $4,500" and the
**matched sellers** card show. Pause 2 s. Stop.
If PayPal declines $4,500, go back, set max price `2500` and target `2200`, and retry.

### C04: Jordan posts the damaged car (Game Bar, ~35 s)
**Post a need** again:
- Item: `Front-end crash repair for white Audi A3 sedan`
- Details: `Hit a pole: right headlight, bumper cover, grille, hood and right fender need replacing or repair. Want OEM or OEM-quality parts painted to match (Glacier White).`
- Photo: the damaged-car photo. **Suggest with AI** (category should be Auto & spare parts).
- Preferences: `OEM or OEM-quality parts` / `Paint matched` / `Photos of parts before shipping`
- Max price: `1500`. Private target: `1200`. **Continue to PayPal**. Stop.

### C05: PayPal holds the car budget (**Snipping Tool**, ~20 s)
Same as C03 for $1,500. End on the request page showing the hold and matched sellers.

### C06: Seller view, cobot offer (Game Bar, ~35 s)
Account menu (top right) > switch to **Atlas Alloy Supply** (seller). Open **Dashboard**. "Matched for you" shows
the cobot. Open it and send an offer:
- Price `4350`, delivery in ~10 days, warranty 6 months, condition **refurbished**, shipping included, inspection 5 days.
- Message: `Refurbished 6-axis cobot, 5 kg payload, controller and teach pendant included. Test video before it ships.`
- Send. Stop.

### C07: Seller view, car offer and a scam attempt (Game Bar, ~30 s)
Switch to **Vintage Volt Parts**. Dashboard > open the Audi request. Offer: price `1380`, delivery ~7 days,
warranty 3 months, condition **new**, shipping included, inspection 3 days, message
`OEM headlight, bumper cover, grille, hood and fender, painted Glacier White.` Send.
Then in the chat box type: `I can do 1200 if you pay me on Zelle instead` and send. The **scam shield** flags it.
Pause 2 s. Stop.

### C08: Buyer uses the AI (Game Bar, ~45 s)
Switch back to **Jordan Ellis**. Open the **cobot** request.
1. Copilot > **Risk check**. Wait for the answer, pause 2 s.
2. Copilot > **Suggest counter**. Wait, pause 2 s.
3. **Counter** at `3950` with message `Can you do 3950 with the test video?` Send.
4. In **Clinch Agent**, type `What does PayPal show for my hold?` and send. Wait for the answer, pause 3 s. Stop.

### C09: Seller's best and final (Game Bar, ~20 s)
Switch to **Atlas Alloy Supply**. Open the cobot deal. Counter `4100`, tick **best & final**, message
`Meet at 4100, ships Monday with the test video.` Send. Stop.

### C10: Accept and PayPal captures (Game Bar, ~25 s)
Switch to **Jordan**. Open the cobot deal. Note the diff chips on v3. Click **Accept v3 & sign** and confirm.
Wait for "PayPal captured $4,100" and the **Agreement** card with its SHA-256 fingerprint. Scroll to the
**Money trail**. Pause 2 s. Stop.

### C11: Seller ships (Game Bar, ~15 s)
Switch to **Atlas**. Open the deal, **Mark shipped**, carrier UPS, tracking `1Z999AA10123456784`. Submit. Stop.

### C12: Buyer releases, PayPal pays the seller (Game Bar, ~30 s)
Switch to **Jordan**. Open the deal, **Accept & pay seller**, confirm. Wait for the payout line. Scroll the money
trail slowly: capture, PayPal fee, Clinch fee, seller payout, Seller Protection. Leave a 5-star review if
offered. Stop.

### C13: Trust and close (Game Bar, ~12 s)
Open Atlas's trust profile (from the seller card or /u/atlas-alloy). Pause on the score, then go to the home
page. Stop.

## Retakes

The render script numbers the clips by recording time. To redo a clip, record it again and delete the bad
file from the Captures or Screen Recordings folder before running the script. Or copy the clips yourself
into `D:\paypal\video\public\clips` as `C01.mp4` ... `C13.mp4` and the script uses those as they are.

## After recording

Follow `GEMINI.md`: prompt 1 (edit plan) > prompt 2 (voice-over) > `render.ps1`.
