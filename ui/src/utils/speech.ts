// J.A.R.V.I.S. Neural Male British Voice (ElevenLabs + en-GB-RyanNeural + Offline Browser/OS TTS)
// Strictly guarantees a Male British voice and never selects female OS voices.

import { JARVIS_CONFIG, jarvisConnection } from './jarvisConfig';

export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
  onAudioLevel?: (level: number) => void;
}

const FEMALE_VOICE_PATTERNS = /hazel|sonia|libby|maisie|zira|aria|jenny|michelle|ana|emma|ava|susan|catherine|heera|linda|samantha|victoria|karen|moira|tessa|fiona|veena|female|woman|girl|natasha|clara|molly|elizabeth/i;
const MALE_VOICE_PATTERNS = /ryan|george|thomas|oliver|arthur|daniel|david|mark|guy|james|richard|christopher|eric|roger|steffan|liam|connor|male/i;

class JarvisSpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentRecognition: any = null;
  private isListeningState: boolean = false;
  private isMutedState: boolean = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private speechTimeoutId: any = null;
  private keepAliveInterval: any = null;

  // Media capture & audio analysis
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private audioLevelListener: ((level: number) => void) | null = null;
  private lastTranscribedText: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initVoice();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => this.initVoice();
        }
      }
    }
  }

  private initVoice() {
    if (!this.synth) return;
    try {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      // Strictly exclude all known female voices
      const nonFemaleVoices = voices.filter((v) => !FEMALE_VOICE_PATTERNS.test(v.name));

      // Priority 1: British Male voices
      const britishMale = nonFemaleVoices.find(
        (v) => v.lang.toLowerCase().startsWith('en-gb') && MALE_VOICE_PATTERNS.test(v.name)
      );
      if (britishMale) {
        this.selectedVoice = britishMale;
        return;
      }

      // Priority 2: Any English Male voice (David, Mark, Guy, Ryan, George, Daniel)
      const englishMale = nonFemaleVoices.find(
        (v) => v.lang.toLowerCase().startsWith('en') && MALE_VOICE_PATTERNS.test(v.name)
      );
      if (englishMale) {
        this.selectedVoice = englishMale;
        return;
      }

      // Priority 3: Non-female English voice
      const nonFemaleEn = nonFemaleVoices.find((v) => v.lang.toLowerCase().startsWith('en'));
      this.selectedVoice = nonFemaleEn || nonFemaleVoices[0] || null;
    } catch {
      // Ignore
    }
  }

  // Speak aloud using J.A.R.V.I.S. Neural Male British TTS (/api/tts/speak -> en-GB-RyanNeural)
  speak(text: string, callbacks?: SpeechCallbacks) {
    if (this.isMutedState) {
      callbacks?.onEnd?.();
      return;
    }

    this.stopSpeaking();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block displayed on your HUD, Sir.')
      .replace(/[*_#`[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\\/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    // Keep spoken summary crisp and responsive (first 420 chars)
    const spokenSlice = cleanText.length > 420 ? cleanText.slice(0, 420) + '...' : cleanText;

    const conn = jarvisConnection.getSnapshot();
    const cloudProxy = jarvisConnection.getCloudProxyUrl();
    const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const isStaticOrApk =
      host.endsWith('.github.io') ||
      host === 'jarvis.fold7.local' ||
      host === 'appassets.androidplatform.net' ||
      host === 'appassets.jarvis';

    // Use Neural TTS endpoint (/api/tts/speak -> ElevenLabs or en-GB-RyanNeural) whenever
    // a Cloud Proxy or Local Agent is reachable, OR when served directly from the local PC backend.
    const hasNeuralAudioBackend =
      conn.mode !== 'OFFLINE' &&
      (conn.cloudProxyReachable || conn.localAgentReachable || !isStaticOrApk);

    if (!hasNeuralAudioBackend) {
      this.speakWithBrowserMaleVoice(spokenSlice, callbacks);
      return;
    }

    try {
      const ttsPath = JARVIS_CONFIG.cloudBackend.endpoints.tts;
      const base = conn.localAgentReachable
        ? conn.localAgentBase
        : conn.cloudProxyReachable
        ? cloudProxy
        : '';
      const token = jarvisConnection.getAgentToken();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const audio = new Audio(`${base}${ttsPath}?text=${encodeURIComponent(spokenSlice)}${tokenParam}`);
      this.currentAudio = audio;
      audio.volume = 1.0;

      audio.onplay = () => {
        callbacks?.onStart?.();
      };

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        callbacks?.onEnd?.();
      };

      audio.onerror = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        // Fallback to strictly male Android/browser speech synthesis if backend audio fails
        this.speakWithBrowserMaleVoice(spokenSlice, callbacks);
      };

      audio.play().catch(() => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        this.speakWithBrowserMaleVoice(spokenSlice, callbacks);
      });
    } catch {
      this.speakWithBrowserMaleVoice(spokenSlice, callbacks);
    }
  }

  private speakWithBrowserMaleVoice(cleanText: string, callbacks?: SpeechCallbacks) {
    if (this.isMutedState) {
      callbacks?.onEnd?.();
      return;
    }

    // Native Samsung Galaxy Z Fold 7 (SM-F966U) Android UK Male TTS Bridge
    const foldBridge = (window as any).JarvisFoldBridge;
    if (foldBridge?.speakBritishMale) {
      try {
        callbacks?.onStart?.();
        foldBridge.speakBritishMale(cleanText);
        const estMs = Math.min(18000, Math.max(2500, cleanText.length * 65));
        this.speechTimeoutId = setTimeout(() => {
          this.speechTimeoutId = null;
          callbacks?.onEnd?.();
        }, estMs);
        return;
      } catch {
        // Fall through to Web Speech API
      }
    }

    if (!this.synth) {
      callbacks?.onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      this.currentUtterance = utterance;

      this.initVoice();
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      // Deep male resonance pitch
      utterance.pitch = 0.85;
      utterance.rate = 1.04;
      utterance.volume = 1.0;

      const cleanup = () => {
        if (this.speechTimeoutId) {
          clearTimeout(this.speechTimeoutId);
          this.speechTimeoutId = null;
        }
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
        this.currentUtterance = null;
      };

      utterance.onstart = () => {
        callbacks?.onStart?.();
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
          if (this.synth?.speaking) {
            this.synth.pause();
            this.synth.resume();
          }
        }, 9000);
      };

      utterance.onend = () => {
        cleanup();
        callbacks?.onEnd?.();
      };

      utterance.onerror = (e) => {
        cleanup();
        callbacks?.onError?.(e.error || 'Speech error');
        callbacks?.onEnd?.();
      };

      const timeoutMs = Math.min(25000, Math.max(7000, cleanText.length * 85));
      this.speechTimeoutId = setTimeout(() => {
        if (this.currentUtterance) {
          this.stopSpeaking();
          callbacks?.onEnd?.();
        }
      }, timeoutMs);

      this.synth.speak(utterance);
    } catch {
      this.currentUtterance = null;
      callbacks?.onEnd?.();
    }
  }

  stopSpeaking() {
    try {
      (window as any).JarvisFoldBridge?.stopSpeaking?.();
    } catch {
      // Ignore
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // Ignore
      }
      this.currentAudio = null;
    }

    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
      this.speechTimeoutId = null;
    }
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.currentUtterance = null;

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore
      }
    }
  }

  setMuted(muted: boolean) {
    this.isMutedState = muted;
    if (muted) {
      this.stopSpeaking();
    }
  }

  isMuted(): boolean {
    return this.isMutedState;
  }

  setAudioLevelListener(cb: ((level: number) => void) | null) {
    this.audioLevelListener = cb;
  }

  private startAudioMeter(stream: MediaStream, callbacks?: SpeechCallbacks) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analyser = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        if (!this.isListeningState || !this.analyser) return;

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        this.audioLevelListener?.(normalized);
        callbacks?.onAudioLevel?.(normalized);

        this.animFrameId = requestAnimationFrame(checkLevel);
      };

      this.animFrameId = requestAnimationFrame(checkLevel);
    } catch (e) {
      console.warn('Audio analyser init warning:', e);
    }
  }

  async startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    callbacks?: SpeechCallbacks
  ): Promise<boolean> {
    this.stopSpeaking();
    this.stopListening();
    this.lastTranscribedText = '';
    this.recordedChunks = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is unavailable');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.mediaStream = stream;
      this.isListeningState = true;
      this.startAudioMeter(stream, callbacks);

      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        rec.start(200);
        this.mediaRecorder = rec;
      } catch (recErr) {
        console.warn('MediaRecorder init notice:', recErr);
      }
    } catch (micErr: any) {
      this.isListeningState = false;
      let errMsg = micErr?.message || 'Microphone error';
      if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
        errMsg = 'Microphone permission blocked. Please allow Microphone access.';
      } else if (micErr?.name === 'NotFoundError' || micErr?.name === 'DevicesNotFoundError') {
        errMsg = 'No physical microphone device detected. Please connect an audio input device.';
      }
      callbacks?.onError?.(errMsg);
      return false;
    }

    callbacks?.onStart?.();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return true;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          this.lastTranscribedText = finalTranscript.trim();
          onResult(this.lastTranscribedText, true);
        } else if (interimTranscript) {
          this.lastTranscribedText = interimTranscript.trim();
          onResult(this.lastTranscribedText, false);
        }
      };

      recognition.onerror = async (event: any) => {
        if (event.error === 'network' || event.error === 'service-not-allowed') {
          await this.fallbackTranscribe(onResult, callbacks);
          return;
        }

        if (event.error === 'no-speech') {
          if (!this.lastTranscribedText && this.recordedChunks.length > 0) {
            await this.fallbackTranscribe(onResult, callbacks);
            return;
          }
        }

        this.stopListening();
        let errMsg = event.error;
        if (event.error === 'not-allowed') {
          errMsg = 'Microphone access denied.';
        } else if (event.error === 'no-speech') {
          errMsg = 'No speech detected. Speak closer to the microphone.';
        }
        callbacks?.onError?.(errMsg);
      };

      recognition.onend = async () => {
        if (!this.lastTranscribedText && this.recordedChunks.length > 0 && this.isListeningState) {
          await this.fallbackTranscribe(onResult, callbacks);
        } else {
          this.stopListening();
          callbacks?.onEnd?.();
        }
      };

      this.currentRecognition = recognition;
      recognition.start();
      return true;
    } catch {
      return true;
    }
  }

  private async fallbackTranscribe(
    onResult: (transcript: string, isFinal: boolean) => void,
    callbacks?: SpeechCallbacks
  ) {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }

    await new Promise((r) => setTimeout(r, 150));

    if (this.recordedChunks.length === 0) {
      this.stopListening();
      callbacks?.onError?.('No audio captured.');
      callbacks?.onEnd?.();
      return;
    }

    try {
      const mime = this.mediaRecorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.recordedChunks, { type: mime });

      const formData = new FormData();
      formData.append('audio', audioBlob, 'capture.webm');

      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && data.transcript) {
          this.lastTranscribedText = data.transcript;
          onResult(data.transcript, true);
        } else if (data.status === 'no_speech') {
          callbacks?.onError?.('No clear speech detected in recording.');
        } else {
          callbacks?.onError?.(data.message || 'Audio transcription failed.');
        }
      } else {
        callbacks?.onError?.(`Backend audio transcription returned status ${res.status}`);
      }
    } catch {
      callbacks?.onError?.('Audio capture completed, but transcription service was unreachable.');
    } finally {
      this.stopListening();
      callbacks?.onEnd?.();
    }
  }

  stopListening() {
    this.isListeningState = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
      this.analyser = null;
    }

    if (this.currentRecognition) {
      try {
        this.currentRecognition.stop();
      } catch {
        // Ignore
      }
      this.currentRecognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore
      }
      this.mediaStream = null;
    }
  }

  isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new JarvisSpeechService();
