import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceRecorderResult {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearError: () => void;
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode audio recording.'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder(
  onTranscript: (text: string) => void
): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      releaseStream();
    };
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMime = pickSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        releaseStream();

        const rawMime = (recorder.mimeType || preferredMime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type: rawMime });
        chunksRef.current = [];

        if (blob.size < 256) {
          setError('Recording was too short. Hold and speak clearly, then stop.');
          return;
        }

        setIsTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const resp = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: rawMime,
            }),
          });
          const data = (await resp.json()) as { text?: string; error?: string };
          if (!resp.ok) {
            throw new Error(data.error || `Transcription failed (HTTP ${resp.status}).`);
          }
          const clean = (data.text || '').trim();
          if (!clean) {
            setError('No speech detected in recording.');
          } else {
            onTranscriptRef.current(clean);
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Unable to transcribe audio recording.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      releaseStream();
      setError(
        err instanceof Error
          ? `Microphone access denied: ${err.message}`
          : 'Unable to access microphone.'
      );
    }
  }, [releaseStream]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    } else {
      setIsRecording(false);
      releaseStream();
    }
  }, [releaseStream]);

  return {
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    clearError: () => setError(null),
  };
}
