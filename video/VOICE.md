# Better voice with Gemini (optional, about 3 minutes)

The video already has a Windows voice. To replace it with a Gemini voice:

1. Open https://aistudio.google.com, then **Generate speech** (Gemini TTS model), single speaker, voice **Charon**.
2. Paste this into the style instructions box:

   Read this as a confident, friendly product demo narrator. Medium pace, about 150 words per minute.
   Clear and warm, not salesy. Pause briefly between paragraphs. Say "clinchdeal dot in" for the web address.

3. Paste the text below as the text to speak, click Run, and download the audio.
4. Save it as `D:\paypal\video\public\voiceover.wav` (replace the old file; .mp3 is fine as `voiceover.mp3`, but then delete `voiceover.wav`).
5. In PowerShell: `cd D:\paypal\video; .\render.ps1`. That takes about 5 minutes. The video re-times itself to the new voice.

## Text to speak

Some things you can't just search for. A cobot for a machine shop. Parts to fix a crashed car. Clinch flips the marketplace: you post the need, and sellers compete for it.

Post the need, PayPal holds the budget, sellers compete, and nobody is paid until you've inspected what arrived.

Jordan runs a machine shop in Denver and needs a small pick and place cobot. He describes it and adds a photo. The AI suggests the category and says why. He sets a max price of four hundred fifty dollars, plus a private target only he can see.

He approves it in PayPal.

This is an authorization, not a charge. PayPal holds the four hundred fifty dollars, so sellers know the money is real before they quote.

The AI matchmaker scores sellers by category and specialty, and invites the best fits.

Jordan also needs his crashed Audi fixed. Same flow: a photo, an AI category, and a fifteen hundred dollar budget for PayPal to hold, paid with PayPal, Venmo or Pay Later.

On the seller side, Relic and Rarity sees a request with the money already held. They offer four hundred seventeen dollars, new, with setup help, and mark it best and final.

Back as the buyer, the copilot, running gpt-oss on Groq, risk-checks the offer against Jordan's preferences and drafts a reply. It never sends, accepts or pays.

Jordan asks the Clinch Agent what PayPal shows. Built on PayPal's Agent Toolkit, it reads the live order: four hundred fifty dollars authorized. Its PayPal tools are read only and locked to this deal.

Then the seller tries to move off platform: pay me on Zelle. The scam shield flags it for both sides, because payments outside Clinch aren't protected.

Jordan accepts. That signs this exact version with a SHA-256 fingerprint, and PayPal captures only the winning price, four hundred seventeen dollars. The other thirty three go back to Jordan. The money trail shows PayPal's fee and Seller Protection.

Relic ships, and the UPS tracking number goes onto the PayPal order.

After inspection, Jordan accepts the delivery and PayPal Payouts pays the seller, minus Clinch's six percent fee. Every PayPal ID is in the money trail.

Both sides review, and trust scores come only from paid, completed deals.

Clinch. PayPal holds the money, AI helps you deal, and everyone gets paid fairly. Try it at clinchdeal dot in.
