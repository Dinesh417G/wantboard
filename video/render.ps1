<#
Clinch demo video: clips -> Gemini edit plan -> voice-over -> rendered MP4 + SRT.

  .\render.ps1              collect clips, check files, render out\clinch-demo.mp4
  .\render.ps1 -Preview     fast half-size render to out\preview.mp4 (check timing first)
  .\render.ps1 -NoVoice     render with captions only (no voice-over file)
  .\render.ps1 -SapiVoice   make a voice-over with the Windows voice if Gemini TTS fails
  .\render.ps1 -Since "2026-11-12 22:15"   only pick up recordings made after this time
  .\render.ps1 -Studio      open Remotion Studio to scrub through the edit in the browser
#>
param(
  [datetime]$Since = (Get-Date).AddHours(-3),
  [switch]$Preview,
  [switch]$NoVoice,
  [switch]$SapiVoice,
  [switch]$Studio
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$clipsDir = Join-Path $PSScriptRoot 'public\clips'
New-Item -ItemType Directory -Force $clipsDir, (Join-Path $PSScriptRoot 'out') | Out-Null
$ffprobe = Join-Path $PSScriptRoot 'node_modules\@remotion\compositor-win32-x64-msvc\ffprobe.exe'
function Get-Dur($f) { [double](& $ffprobe -v error -show_entries format=duration -of csv=p=0 $f) }

# 1. Clips: use public\clips\C01.mp4... if present, else collect recordings in the order they were made.
$have = @(Get-ChildItem $clipsDir -Filter '*.mp4' -ErrorAction SilentlyContinue)
if ($have.Count -eq 0) {
  $sources = @("$env:USERPROFILE\Videos\Captures", "$env:USERPROFILE\Videos\Screen Recordings", "$env:USERPROFILE\OneDrive\Videos\Captures", "$env:USERPROFILE\OneDrive\Videos\Screen Recordings")
  $found = @($sources | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Filter *.mp4 } |
    Where-Object { $_.LastWriteTime -ge $Since } | Sort-Object LastWriteTime)
  if ($found.Count -eq 0) { Write-Host "No recordings found after $Since in Videos\Captures or Videos\Screen Recordings." -ForegroundColor Red; exit 1 }
  $i = 1
  foreach ($f in $found) {
    $name = 'C{0:D2}.mp4' -f $i
    Copy-Item $f.FullName (Join-Path $clipsDir $name)
    Write-Host ("{0}  <-  {1}  ({2:N1} s, {3:HH:mm:ss})" -f $name, $f.Name, (Get-Dur $f.FullName), $f.LastWriteTime)
    $i++
  }
  Write-Host "Check the order above against SHOOT.md. Wrong? Fix the files in public\clips and run again." -ForegroundColor Yellow
}
$list = Get-ChildItem $clipsDir -Filter '*.mp4' | Sort-Object Name | ForEach-Object { '{0}  {1:N1} s' -f $_.Name, (Get-Dur $_.FullName) }
$list | Set-Content (Join-Path $PSScriptRoot 'out\clips.txt')

# 2. Edit plan from Gemini.
if (-not (Test-Path 'public\edit.json')) {
  Write-Host "`nClips ready in $clipsDir :" -ForegroundColor Cyan
  $list | ForEach-Object { "  $_" }
  Write-Host "`nNext: GEMINI.md prompt 1. Upload these clips to Google AI Studio, paste the prompt, save the JSON answer as public\edit.json, then run .\render.ps1 again." -ForegroundColor Yellow
  exit 0
}

# 3. Validate, time, write narration.txt + SRT.
node tools\prep.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$voice = @('public\voiceover.wav', 'public\voiceover.mp3', 'public\voiceover.m4a') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $voice -and $SapiVoice) {
  Write-Host 'Making a voice-over with the Windows voice...' -ForegroundColor Cyan
  $src = if (Test-Path 'out\tts-input.txt') { 'out\tts-input.txt' } else { 'out\narration.txt' }  # tts-input = spoken spellings
  $txt = (Resolve-Path $src).Path
  $wav = Join-Path $PSScriptRoot 'public\voiceover.wav'
  powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Speech; `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; `$v = `$s.GetInstalledVoices() | Where-Object { `$_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1; if (`$v) { `$s.SelectVoice(`$v.VoiceInfo.Name) }; `$s.Rate = 1; `$s.SetOutputToWaveFile('$wav'); `$s.Speak([IO.File]::ReadAllText('$txt')); `$s.Dispose()"
  node tools\prep.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $voice = 'public\voiceover.wav'
}
if (-not $voice -and -not $NoVoice -and -not $Studio) {
  Write-Host "`nNo voice-over yet. GEMINI.md prompt 2: paste out\narration.txt into AI Studio speech, save as public\voiceover.wav, run again." -ForegroundColor Yellow
  Write-Host 'Or render now with -NoVoice (captions only) or -SapiVoice (Windows voice).' -ForegroundColor Yellow
  exit 0
}

if ($Studio) { npx remotion studio src/index.ts; exit $LASTEXITCODE }

# 4. Render.
$rargs = @('remotion', 'render', 'src/index.ts', 'Clinch')
if ($Preview) { $out = 'out\preview.mp4'; $rargs += @($out, '--scale', '0.5', '--crf', '30') }
else { $out = 'out\clinch-demo.mp4'; $rargs += @($out, '--crf', '18') }
$rargs += @('--codec', 'h264', '--concurrency', '50%', '--log', 'warn')
$sw = [Diagnostics.Stopwatch]::StartNew()
npx @rargs
if ($LASTEXITCODE -ne 0) { Write-Host 'Render failed (see above).' -ForegroundColor Red; exit $LASTEXITCODE }
Write-Host ("`nDone in {0:N0} s: {1}" -f $sw.Elapsed.TotalSeconds, (Resolve-Path $out)) -ForegroundColor Green
Write-Host ("Subtitles for YouTube: {0}" -f (Resolve-Path 'out\clinch-demo.srt'))
