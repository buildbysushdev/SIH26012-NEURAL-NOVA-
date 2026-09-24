"""
voice_transcriber.py — Audio-to-Text Transcription Service
MPLADS Risk Intelligence System — SIH26102 (Team Neural Nova)

Provides a lightweight fallback transcription service using Gemini Flash
for browsers where client-side Web Speech API is unavailable or returns empty.

Compliance:
- Audio is processed in memory and never written or stored to disk (Rule 5).
- Reuses the official google.genai SDK with model rotation.
- Token/cost-efficient: single call per recording fallback only.
"""

import os
import io
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Voice Transcription"])

# Supported model rotation (fastest & most cost-efficient flash models)
_FLASH_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

class TranscriptionResponse(BaseModel):
    transcription: str
    status: str
    engine: str

@router.post("/transcribe-audio", response_model=TranscriptionResponse)
async def transcribe_audio_endpoint(
    audio: UploadFile = File(..., description="Audio recording blob (WebM, WAV, OGG, MP4)")
):
    """
    Transcribes audio recording into verbatim text.
    Processes audio completely in-memory and immediately discards it.
    Zero raw audio is saved to server storage.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_API_KEY is not configured on the server."
        )

    # Read audio bytes (cap at 10MB to prevent abuse)
    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty or too short."
        )
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds the 10MB limit."
        )

    content_type = audio.content_type or "audio/webm"
    if "webm" in content_type:
        mime_type = "audio/webm"
    elif "wav" in content_type:
        mime_type = "audio/wav"
    elif "ogg" in content_type:
        mime_type = "audio/ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        mime_type = "audio/mp4"
    else:
        mime_type = "audio/webm"

    prompt_instruction = (
        "You are an official speech-to-text transcriber for the Indian Government's "
        "MPLAD scheme public grievance system.\n"
        "Transcribe the spoken audio accurately and verbatim in the language spoken "
        "(e.g. English, Hindi, or regional Indian language).\n"
        "Rules:\n"
        "1. Return ONLY the transcribed text.\n"
        "2. Do NOT add preamble, commentary, markdown headings, or quotes.\n"
        "3. If the audio is silent or unintelligible noise, return exactly: NO_SPEECH_DETECTED."
    )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        part = types.Part.from_bytes(
            data=audio_bytes,
            mime_type=mime_type,
        )

        last_err = None
        for model_name in _FLASH_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[part, prompt_instruction],
                    config=types.GenerateContentConfig(
                        max_output_tokens=300,
                        temperature=0.0,
                    ),
                )
                raw_text = (response.text or "").strip()
                if "NO_SPEECH_DETECTED" in raw_text or not raw_text:
                    return TranscriptionResponse(
                        transcription="",
                        status="no_speech",
                        engine=f"gemini ({model_name})"
                    )
                
                # Success
                return TranscriptionResponse(
                    transcription=raw_text,
                    status="success",
                    engine=f"gemini ({model_name})"
                )
            except Exception as e:
                logger.warning(f"Model {model_name} failed transcription: {e}")
                last_err = e
                continue

        logger.error(f"All Gemini models exhausted for audio transcription: {last_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech transcription failed: {str(last_err)}"
        )

    except ImportError:
        logger.error("google.genai SDK is not installed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google.genai SDK is missing."
        )
