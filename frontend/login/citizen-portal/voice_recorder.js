/**
 * voice_recorder.js — Voice-Based Grievance Recording & Transcription Module
 * MPLADS Risk Intelligence System — SIH26102 (Team Neural Nova)
 * 
 * Provides an optional, accessible audio recording mechanism for citizens.
 * Aesthetics: Official Government of India / NIC Portal Style
 * (High contrast, white panel, deep blue accents, clear typography).
 * 
 * Multi-Tier Transcription Architecture:
 * - Tier 1: Real-time browser SpeechRecognition (fast, client-side, zero latency)
 * - Tier 2: Automatic server fallback via POST /transcribe-audio (Gemini Flash in-memory)
 * - Rule 5 Compliance: Audio is never saved to disk; in-memory processing only.
 * - Non-blocking: Citizen can always type directly into the description box at any time.
 */

let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let timerInterval = null;
let secondsElapsed = 0;
const MAX_RECORDING_SECONDS = 90; // 1.5 minutes maximum

// Speech recognition handle
let speechRecognition = null;
let speechRecognizedText = '';

function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    const ls = localStorage.getItem('MPLADS_API_URL') || localStorage.getItem('mplads_api_url');
    if (ls) return ls;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.includes('8080')) {
      return 'http://localhost:8000';
    }
    const meta = document.querySelector('meta[name="backend-url"]');
    if (meta && meta.content) return meta.content;
  }
  return 'https://mplads-neural-nova-26102.loca.lt';
}

export function initVoiceRecorder() {
  const toggleBtn           = document.getElementById('btn-toggle-voice');
  const panel               = document.getElementById('voice-recorder-panel');
  const startStopBtn        = document.getElementById('voice-start-stop-btn');
  const resetBtn            = document.getElementById('voice-reset-btn');
  const timerBadge          = document.getElementById('voice-timer-badge');
  const statusText          = document.getElementById('voice-status-text');
  const audioPreview        = document.getElementById('voice-audio-preview');
  const errorBox            = document.getElementById('voice-error-box');

  // Stage 2 Review & Transcription DOM elements
  const transcriptionLoader = document.getElementById('voice-transcribing-loader');
  const transcriptionBox    = document.getElementById('voice-transcription-box');
  const transcriptionBadge  = document.getElementById('voice-transcription-engine');
  const transcriptionText   = document.getElementById('voice-transcription-preview');
  const useTextBtn          = document.getElementById('btn-use-voice-text');
  const clearTextBtn        = document.getElementById('btn-clear-voice-text');
  const descriptionTextarea = document.getElementById('description');

  if (!toggleBtn || !panel) return;

  // Toggle voice panel visibility
  toggleBtn.addEventListener('click', () => {
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'block' : 'none';
    toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    toggleBtn.classList.toggle('active', isHidden);
    if (!isHidden && mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    }
  });

  // Start / Stop recording button
  if (startStopBtn) {
    startStopBtn.addEventListener('click', async () => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        await startRecording();
      } else if (mediaRecorder.state === 'recording') {
        stopRecording();
      }
    });
  }

  // Reset / Re-record button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetRecordingUI();
    });
  }

  // Use transcribed text in main report description
  if (useTextBtn && transcriptionText && descriptionTextarea) {
    useTextBtn.addEventListener('click', () => {
      const recognized = transcriptionText.value.trim();
      if (!recognized) return;

      const currentVal = descriptionTextarea.value.trim();
      if (!currentVal) {
        descriptionTextarea.value = recognized.slice(0, 500);
      } else {
        // Append with a space, capped at 500 chars
        descriptionTextarea.value = (currentVal + ' ' + recognized).slice(0, 500);
      }

      // Dispatch 'input' event so char counter & validation update
      descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Button feedback
      const origText = useTextBtn.innerHTML;
      useTextBtn.innerHTML = '✓ Added to Report';
      useTextBtn.style.background = '#166534';
      setTimeout(() => {
        useTextBtn.innerHTML = origText;
        useTextBtn.style.background = '';
      }, 2000);

      // Scroll smoothly to description field
      descriptionTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      descriptionTextarea.focus();
    });
  }

  // Clear transcribed text preview
  if (clearTextBtn && transcriptionText) {
    clearTextBtn.addEventListener('click', () => {
      transcriptionText.value = '';
      if (transcriptionBox) transcriptionBox.style.display = 'none';
    });
  }

  async function startRecording() {
    clearError();
    audioChunks = [];
    audioBlob = null;
    speechRecognizedText = '';

    if (transcriptionBox) transcriptionBox.style.display = 'none';
    if (transcriptionLoader) transcriptionLoader.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Audio recording is not supported in this browser. Please type your description manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine optimal mimeType
      const mimeType = getSupportedMimeType();
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        // Release hardware mic tracks
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob && audioBlob.size > 0) {
          const audioUrl = URL.createObjectURL(audioBlob);
          audioPreview.src = audioUrl;
          audioPreview.style.display = 'block';
          statusText.textContent = 'Audio recorded successfully. Click play to review:';
          statusText.className = 'voice-status-text success';
          timerBadge.textContent = '✓ Recorded (' + formatTime(secondsElapsed) + ')';
          timerBadge.className = 'voice-timer-badge captured';
          resetBtn.style.display = 'inline-flex';
          startStopBtn.style.display = 'none';

          // Proceed to Speech-to-Text transcription
          await handleTranscription(audioBlob);
        } else {
          showError('No audio data was captured. Please try recording again.');
          resetRecordingUI();
        }
      };

      // Start client speech recognition in parallel if supported
      startClientSpeechRecognition();

      mediaRecorder.start(250); // collect 250ms chunks
      secondsElapsed = 0;
      updateTimerDisplay();

      // UI state during recording
      startStopBtn.innerHTML = '⏹ Stop Recording';
      startStopBtn.className = 'gov-voice-btn stop';
      statusText.textContent = 'Recording in progress… Speak clearly into your microphone.';
      statusText.className = 'voice-status-text recording';
      timerBadge.className = 'voice-timer-badge active';
      audioPreview.style.display = 'none';
      resetBtn.style.display = 'none';

      // Start timer tick
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
        if (secondsElapsed >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showError('Microphone permission was denied. You can continue typing your description manually.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        showError('No microphone was detected on this device. Please type your description manually.');
      } else {
        showError('Unable to access microphone: ' + (err.message || 'Unknown error'));
      }
      resetRecordingUI();
    }
  }

  function stopRecording() {
    clearInterval(timerInterval);
    stopClientSpeechRecognition();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  function resetRecordingUI() {
    clearInterval(timerInterval);
    stopClientSpeechRecognition();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    audioChunks = [];
    audioBlob = null;
    speechRecognizedText = '';
    secondsElapsed = 0;

    startStopBtn.innerHTML = '🎙️ Start Recording';
    startStopBtn.className = 'gov-voice-btn start';
    startStopBtn.style.display = 'inline-flex';
    statusText.textContent = 'Press "Start Recording" and describe the MPLAD project issue.';
    statusText.className = 'voice-status-text';
    timerBadge.textContent = '00:00';
    timerBadge.className = 'voice-timer-badge';
    audioPreview.src = '';
    audioPreview.style.display = 'none';
    resetBtn.style.display = 'none';

    if (transcriptionBox) transcriptionBox.style.display = 'none';
    if (transcriptionLoader) transcriptionLoader.style.display = 'none';
    if (transcriptionText) transcriptionText.value = '';
    clearError();
  }

  // ─── Tier 1: Client-Side Web Speech Recognition ───
  function startClientSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      speechRecognition = new SpeechRecognition();
      speechRecognition.continuous = true;
      speechRecognition.interimResults = false;
      speechRecognition.maxAlternatives = 1;
      speechRecognition.lang = 'en-IN'; // Default Indian English / mixed

      speechRecognition.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            text += event.results[i][0].transcript + ' ';
          }
        }
        if (text) {
          speechRecognizedText = (speechRecognizedText + ' ' + text).trim();
        }
      };

      speechRecognition.onerror = (e) => {
        console.warn('SpeechRecognition client error:', e.error);
      };

      speechRecognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed:', e);
      speechRecognition = null;
    }
  }

  function stopClientSpeechRecognition() {
    if (speechRecognition) {
      try {
        speechRecognition.stop();
      } catch (_) {}
      speechRecognition = null;
    }
  }

  // ─── Tier 2: Automatic Fallback to Server Transcription ───
  async function handleTranscription(blob) {
    // If client-side speech recognition already captured text:
    if (speechRecognizedText && speechRecognizedText.trim().length >= 5) {
      displayTranscriptionResult(speechRecognizedText.trim(), 'Browser Speech-to-Text');
      return;
    }

    // Otherwise, call backend /transcribe-audio
    if (!transcriptionLoader) return;
    transcriptionLoader.style.display = 'flex';
    if (transcriptionBox) transcriptionBox.style.display = 'none';

    try {
      const apiBase = getApiBase();
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch(`${apiBase}/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      transcriptionLoader.style.display = 'none';

      if (data && data.transcription && data.transcription.trim().length > 0) {
        const engineLabel = data.engine ? `AI Speech-to-Text (${data.engine})` : 'AI Speech-to-Text';
        displayTranscriptionResult(data.transcription.trim(), engineLabel);
      } else {
        // No speech detected
        statusText.textContent = 'Voice note recorded. No speech was detected — you can review playback above or type below.';
        statusText.className = 'voice-status-text';
      }

    } catch (apiErr) {
      console.warn('Server audio transcription unavailable:', apiErr);
      transcriptionLoader.style.display = 'none';
      statusText.textContent = 'Voice note recorded. You can listen to your recording above and type your note below.';
      statusText.className = 'voice-status-text';
    }
  }

  function displayTranscriptionResult(text, engine) {
    if (!transcriptionBox || !transcriptionText) return;
    transcriptionText.value = text;
    if (transcriptionBadge) transcriptionBadge.textContent = engine || 'Speech-to-Text';
    transcriptionBox.style.display = 'block';
    statusText.textContent = 'Speech transcribed! Review or edit the recognized text below:';
    statusText.className = 'voice-status-text success';
  }

  function updateTimerDisplay() {
    timerBadge.textContent = formatTime(secondsElapsed);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  function getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }
}

/**
 * Returns current recorded audio Blob (if any).
 */
export function getRecordedVoiceBlob() {
  return audioBlob;
}
