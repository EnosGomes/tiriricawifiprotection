Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$audioDir = Join-Path $PSScriptRoot "audio"

if (-not (Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir | Out-Null
}

$synth.SetOutputToWaveFile((Join-Path $audioDir "acertou.wav"))
$synth.Speak("Acertou Abestado!")

$synth.SetOutputToWaveFile((Join-Path $audioDir "errou.wav"))
$synth.Speak("Errou Abestado!")

$synth.SetOutputToWaveFile((Join-Path $audioDir "aplausos.wav"))
$synth.Speak("Parabens!")

Write-Host "Audio files generated in $audioDir"
