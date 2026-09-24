/**
 * voice_recorder.js — Voice-Based Grievance Recording Module
 * MPLADS Risk Intelligence System — SIH26102 (Team Neural Nova)
 * 
 * Provides an optional, accessible audio recording mechanism for citizens.
 * Aesthetics: Official Government of India / NIC Portal Style
 * (High contrast, white panel, deep blue accents, clear typography).
 * 
 * Stage 1: UI & Audio Recording (MediaRecorder + Local Playback)
 * - Safe microphone permission requests
 * - Live recording timer (MM:SS)
 * - Playback before submission
 * - Graceful fallback to manual typing if mic unavailable
 */

let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let timerInterval = null;
let secondsElapsed = 0;
const MAX_RECORDING_SECONDS = 90; // 1.5 minutes maximum

export function initVoiceRecorder() {
  const toggleBtn      = document.getElementById('btn-toggle-voice');
  const panel          = document.getElementById('voice-recorder-panel');
  const startStopBtn   = document.getElementById('voice-start-stop-btn');
  const resetBtn       = document.getElementById('voice-reset-btn');
  const timerBadge     = document.getElementById('voice-timer-badge');
  const statusText     = document.getElementById('voice-status-text');
  const audioPreview   = document.getElementById('voice-audio-preview');
  const errorBox       = document.getElementById('voice-error-box');

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

  async function startRecording() {
    clearError();
    audioChunks = [];
    audioBlob = null;

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

      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        // Release hardware mic tracks
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob && audioBlob.size > 0) {
          const audioUrl = URL.createObjectURL(audioBlob);
          audioPreview.src = audioUrl;
          audioPreview.style.display = 'block';
          statusText.textContent = 'Audio recorded successfully. Click play to review your voice note:';
          statusText.className = 'voice-status-text success';
          timerBadge.textContent = '✓ Recorded (' + formatTime(secondsElapsed) + ')';
          timerBadge.className = 'voice-timer-badge captured';
          resetBtn.style.display = 'inline-flex';
          startStopBtn.style.display = 'none';
        } else {
          showError('No audio data was captured. Please try recording again.');
          resetRecordingUI();
        }
      };

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
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  function resetRecordingUI() {
    clearInterval(timerInterval);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    audioChunks = [];
    audioBlob = null;
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
    clearError();
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
 * Stage 2 will feed this to Speech-to-Text.
 */
export function getRecordedVoiceBlob() {
  return audioBlob;
}
