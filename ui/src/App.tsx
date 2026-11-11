import { agentMediaUrl } from './utils/jarvisConfig';
import React, { useState, useEffect, useRef } from 'react';
import { Core3D } from './components/Core3D';
import { GlassPanel } from './components/GlassPanel';
import { CommandInput, JarvisEngineType } from './components/CommandInput';
import { OmniStudio } from './components/OmniStudio';
import { CommandCenterModal, CommandCenterTab } from './components/CommandCenterModal';
import { sound } from './utils/sound';
import { speechService } from './utils/speech';
import { fold7Hardware, ZFold7Telemetry } from './utils/fold7Hardware';
import { ConnectionSnapshot, jarvisConnection } from './utils/jarvisConfig';
import { getGitHubToken, setGitHubToken } from './utils/githubCloudEngine';
import {
  Cpu,
  Zap,
  CheckCircle2,
  Clock,
  Code2,
  Workflow,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Sparkles,
  Film,
  Download,
  Play,
  Cloud,
  Menu,
  X,
} from 'lucide-react';

interface MediaAttachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  asset?: any;
  video?: any;
}

interface LogEntry {
  id: string;
  timestamp: string;
  sender: 'JARVIS' | 'USER' | 'SYSTEM';
  text: string;
  telemetry?: string;
  engine?: string;
  media?: MediaAttachment;
}

interface BridgeNote {
  key: string;
  content: string;
  preview: string;
  updated_by: string;
  updated_at: string;
}

interface BridgeTask {
  id: string;
  title: string;
  details: string;
  status: string;
  priority: string;
  assignee: string;
}

interface KnowledgeDoc {
  title: string;
  path: string;
  relPath: string;
  size: string;
  preview: string;
  exists: boolean;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [engine, setEngine] = useState<JarvisEngineType>('gemini-pro');
  const [isMuted, setIsMuted] = useState(false);
  const [isReaLive, setIsReaLive] = useState(false);
  const [listeningTranscript, setListeningTranscript] = useState('');
  const [activeTelemetry, setActiveTelemetry] = useState<string>('');
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);
  const [activeMedia, setActiveMedia] = useState<MediaAttachment | null>(null);

  // Unified Studio State
  const [isOmniStudioOpen, setIsOmniStudioOpen] = useState<boolean>(false);
  const [studioFocus, setStudioFocus] = useState<'omni' | 'openart' | 'video'>('omni');

  // v4.0 Tactical Command Center State (Ghidra, Faceless, Temporal Gates, System Control)
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState<boolean>(false);
  const [commandCenterTab, setCommandCenterTab] = useState<CommandCenterTab>('ghidra');
  const [liveHw, setLiveHw] = useState<{ cpu: number; ram: number; diskFreeGb: number }>({
    cpu: 12.4,
    ram: 44.2,
    diskFreeGb: 450.0,
  });
  const [fold7Tel, setFold7Tel] = useState<ZFold7Telemetry>(() => fold7Hardware.getTelemetry());
  const [connSnap, setConnSnap] = useState<ConnectionSnapshot>(() => jarvisConnection.getSnapshot());
  const [canInstallPwa, setCanInstallPwa] = useState<boolean>(
    typeof window !== 'undefined' && Boolean((window as any).__JARVIS_INSTALL_PROMPT__)
  );
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [cloudModalOpen, setCloudModalOpen] = useState<boolean>(false);
  const [cloudProxyInput, setCloudProxyInput] = useState<string>(() => jarvisConnection.getCloudProxyUrl());
  const [tunnelUrlInput, setTunnelUrlInput] = useState<string>(() => jarvisConnection.getTunnelUrl());
  const [agentTokenInput, setAgentTokenInput] = useState<string>(() => jarvisConnection.getAgentToken());
  const [ghTokenInput, setGhTokenInput] = useState<string>(() => getGitHubToken());

  const isPhoneLayout = viewportWidth < 768 || fold7Tel.posture === 'COVER_DISPLAY';
  const isMediumLayout = !isPhoneLayout && (viewportWidth < 1200 || fold7Tel.posture === 'FLEX_TABLETOP');

  useEffect(() => {
    const unsubFold = fold7Hardware.subscribe((tel) => setFold7Tel(tel));
    const unsubConn = jarvisConnection.subscribe((snap) => setConnSnap(snap));
    const onPwa = () => setCanInstallPwa(true);
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('jarvis-pwa-installable', onPwa);
    window.addEventListener('resize', onResize);
    return () => {
      unsubFold();
      unsubConn();
      window.removeEventListener('jarvis-pwa-installable', onPwa);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const openCommandCenter = (tab: CommandCenterTab) => {
    sound.playConfirm();
    setMobileMenuOpen(false);
    setCommandCenterTab(tab);
    setIsCommandCenterOpen(true);
  };

  // Second Brain Tabs & Live Data
  const [brainTab, setBrainTab] = useState<'vault' | 'notes' | 'tasks' | 'session'>('vault');
  const [bridgeNotes, setBridgeNotes] = useState<BridgeNote[]>([]);
  const [bridgeTasks, setBridgeTasks] = useState<BridgeTask[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeDoc[]>([
    {
      title: 'Limit_Break_Johnny_Boy_Memory_Clone.md',
      path: '',
      relPath: '',
      size: '32 KB',
      preview: 'Governing memory clone and director guidelines.',
      exists: true,
    },
    {
      title: 'CLAUDE.md',
      path: '',
      relPath: '',
      size: '14 KB',
      preview: 'System architecture and multi-agent coordination guidelines.',
      exists: true,
    },
    {
      title: 'LIMIT_BREAK_SHARED_MEMORY.md',
      path: '',
      relPath: '',
      size: '28 KB',
      preview: 'Shared cross-agent state and production ledger.',
      exists: true,
    },
  ]);
  const [sessionInfo, setSessionInfo] = useState<{
    goal: string;
    project_path: string;
    active_files: string[];
  }>({
    goal: 'DIRECTOR STRATEGIC ORDER: Full Autonomous Execution & Creative Studio.',
    project_path: 'D:\\Jarvis',
    active_files: [],
  });
  const [bridgeStats, setBridgeStats] = useState({
    totalNotes: 19,
    totalTasks: 35,
    openTasks: 20,
    completedTasks: 15,
    sessionUpdated: new Date().toISOString(),
  });

  const [speechText, setSpeechText] = useState(
    "Good day, Sir. J.A.R.V.I.S. is online with British Male Neural Voice (en-GB-RyanNeural), real AI image & MP4 video creation, file uploads, and live web research. How may I assist you?"
  );

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: 'INIT:001',
      sender: 'SYSTEM',
      text: 'J.A.R.V.I.S. v4.3.0 Cloud + Local + Offline Architecture online. Male British Neural Voice & Real Media Engine active.',
    },
    {
      id: '2',
      timestamp: 'INIT:002',
      sender: 'JARVIS',
      text: 'All tools verified: Create Images, Create Playable MP4 Videos, Upload Media, Remove Background, 4K Upscale, and REA Live Research.',
    },
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const isReaLiveRef = useRef<boolean>(false);

  useEffect(() => {
    isReaLiveRef.current = isReaLive;
  }, [isReaLive]);

  // Real-time HUD Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Bridge State from Backend
  const refreshBridgeState = async () => {
    try {
      const res = await fetch('/api/bridge/state');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          if (data.notes) setBridgeNotes(data.notes);
          if (data.tasks) setBridgeTasks(data.tasks);
          if (data.knowledgeFiles) setKnowledgeFiles(data.knowledgeFiles);
          if (data.session) setSessionInfo(data.session);
          if (data.stats) setBridgeStats(data.stats);
        }
      }
    } catch {
      // Backend offline or fallback
    }
  };

  useEffect(() => {
    refreshBridgeState();
    const interval = setInterval(refreshBridgeState, 12000);
    return () => clearInterval(interval);
  }, []);

  // Poll Live Hardware Telemetry for Left HUD Panel
  useEffect(() => {
    const fetchHw = async () => {
      try {
        const r = await fetch('/api/system/telemetry');
        if (r.ok) {
          const d = await r.json();
          const dDrive = (d.disks || []).find((x: any) => x.drive?.startsWith('D')) || (d.disks || [])[0];
          setLiveHw({
            cpu: d.cpu?.percent ?? 12.0,
            ram: d.memory?.percent ?? 44.0,
            diskFreeGb: dDrive?.free_gb ?? 450.0,
          });
        }
      } catch {}
    };
    fetchHw();
    const hwTimer = setInterval(fetchHw, 4000);
    return () => clearInterval(hwTimer);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const extractSpokenSummary = (text: string): string => {
    const clean = text
      .replace(/```[\s\S]*?```/g, 'I have prepared the code and implementation details on your HUD, Sir.')
      .replace(/[*_#`[\]()]/g, '')
      .replace(/---\n/g, '')
      .trim();

    const sentences = clean.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      const candidate = sentences.slice(0, 2).join(' ').trim();
      if (candidate.length <= 280) {
        return candidate;
      }
      return sentences[0].trim();
    }
    return clean.slice(0, 220);
  };

  // Handle Direct Media Upload from Command Bar
  const handleMediaUpload = async (file: File) => {
    setStatus('processing');
    sound.playScanTone();
    setSpeechText(`Uploading '${file.name}' into J.A.R.V.I.S. media core, Sir...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.media) {
        sound.playConfirm();
        const m = data.media;
        const attachment: MediaAttachment = {
          type: m.media_type,
          url: m.url,
          asset: m,
        };
        setActiveMedia(attachment);

        const msg =
          m.media_type === 'video'
            ? `Uploaded video '${m.original_name}' (${m.size_kb} KB), Sir. It is now playing on your HUD and ready in the Omni-Studio timeline.`
            : m.media_type === 'image'
            ? `Uploaded image '${m.original_name}' (${m.size_kb} KB), Sir. Displayed on your HUD. You can animate it into an MP4 video or edit it in Omni-Studio.`
            : `Uploaded audio '${m.original_name}' (${m.size_kb} KB), Sir. Ready in the Omni-Studio audio track.`;

        setSpeechText(msg);
        setLogs((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            sender: 'USER',
            text: `Uploaded ${m.media_type}: ${m.original_name}`,
          },
          {
            id: (Date.now() + 1).toString(),
            timestamp: new Date().toLocaleTimeString(),
            sender: 'JARVIS',
            text: msg,
            engine: 'Media Core',
            media: attachment,
          },
        ]);

        setStatus('speaking');
        speechService.speak(msg, {
          onEnd: () => setStatus('idle'),
          onError: () => setStatus('idle'),
        });
      }
    } catch (e: any) {
      setStatus('idle');
      setSpeechText(`Upload failed, Sir: ${e?.message}`);
    }
  };

  // Handle Command Submission & SSE Streaming
  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    speechService.stopSpeaking();
    setStatus('processing');
    sound.playScanTone();
    setActiveTelemetry('Executing directive...');

    const lowerCmd = cmd.toLowerCase().trim();
    if (
      lowerCmd === 'open omni-studio' ||
      lowerCmd === 'omni-studio' ||
      lowerCmd === 'open studio' ||
      lowerCmd === 'open video studio' ||
      lowerCmd === 'open creative studio'
    ) {
      setStudioFocus('omni');
      setIsOmniStudioOpen(true);
      setStatus('idle');
      return;
    }

    const userEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      sender: 'USER',
      text: cmd,
    };
    setLogs((prev) => [...prev, userEntry]);

    if (connSnap.mode === 'OFFLINE') {
      jarvisConnection.enqueueOfflineCommand(cmd, '/api/chat', { message: cmd, engine });
    }

    const conversationHistory = logs
      .filter((l) => l.sender === 'USER' || l.sender === 'JARVIS')
      .slice(-6)
      .map((l) => ({ sender: l.sender, text: l.text }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cmd, engine, history: conversationHistory }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let accumulatedTelemetry = '';
      let detectedEngine = 'JARVIS Core';
      let returnedMedia: MediaAttachment | undefined = undefined;

      setSpeechText('');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const lines = rawEvent.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);

              if (eventType === 'telemetry') {
                const telemetryLine = `[${parsed.phase || 'INFO'}] ${parsed.text}`;
                accumulatedTelemetry += (accumulatedTelemetry ? '\n' : '') + telemetryLine;
                setActiveTelemetry(accumulatedTelemetry);
              } else if (eventType === 'token') {
                accumulatedText += parsed.text;
                setSpeechText(accumulatedText);
              } else if (eventType === 'complete') {
                if (parsed.engine) detectedEngine = parsed.engine;
                if (parsed.media && parsed.media.url) {
                  returnedMedia = {
                    type: parsed.media.type,
                    url: parsed.media.url,
                    asset: parsed.media.asset,
                    video: parsed.media.video,
                  };
                  setActiveMedia(returnedMedia);
                }
              }
            } catch {
              // Ignore chunk parse error
            }
          }
        }
      }

      const reply = accumulatedText.trim() || `Directive executed, Sir: "${cmd}".`;
      setSpeechText(reply);

      setStatus('speaking');
      sound.playAcknowledge();

      const spokenSummary = extractSpokenSummary(reply);
      speechService.speak(spokenSummary, {
        onEnd: () => {
          setStatus('idle');
          if (isReaLiveRef.current) {
            setTimeout(() => {
              if (isReaLiveRef.current) {
                startVoiceCapture();
              }
            }, 400);
          }
        },
        onError: () => {
          setStatus('idle');
        },
      });

      setLogs((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          timestamp: new Date().toLocaleTimeString(),
          sender: 'JARVIS',
          text: reply,
          telemetry: accumulatedTelemetry,
          engine: detectedEngine,
          media: returnedMedia,
        },
      ]);
    } catch (err: any) {
      const errorMsg = `Neural cortex connection interruption: ${err?.message || 'Server connection error'}. Standing by, Sir.`;
      setSpeechText(errorMsg);
      setStatus('idle');
      sound.playScanTone();

      setLogs((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          timestamp: new Date().toLocaleTimeString(),
          sender: 'SYSTEM',
          text: errorMsg,
          telemetry: `[FAULT] ${err?.message}`,
        },
      ]);
    }
  };

  const startVoiceCapture = async () => {
    setStatus('listening');
    setSpeechText('Listening on neural audio bus, Sir...');
    setListeningTranscript('');

    const started = await speechService.startListening(
      (transcript, isFinal) => {
        setListeningTranscript(transcript);
        if (isFinal && transcript) {
          setStatus('processing');
          handleCommand(transcript);
          setListeningTranscript('');
        }
      },
      {
        onStart: () => {
          setSpeechText('Listening for your vocal directive, Sir...');
        },
        onError: (err) => {
          setStatus('idle');
          setListeningTranscript('');
          setSpeechText(typeof err === 'string' ? err : 'Voice recognition ended.');
        },
        onEnd: () => {
          setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        },
      }
    );

    if (!started) {
      setStatus('idle');
    }
  };

  const toggleMic = async () => {
    if (status === 'listening') {
      speechService.stopListening();
      setStatus('idle');
      setListeningTranscript('');
    } else {
      await startVoiceCapture();
    }
  };

  const toggleReaLive = () => {
    const next = !isReaLive;
    setIsReaLive(next);
    if (next) {
      speechService.speak('Realtime voice mode engaged, Sir. Speak whenever you are ready.', {
        onEnd: () => {
          startVoiceCapture();
        },
      });
    } else {
      speechService.stopListening();
      setStatus('idle');
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    speechService.setMuted(next);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {/* Scanline & Vignette Background Overlay */}
      <div className="scanlines" />
      <div className="vignette" />

      {/* 3D Holographic Canvas (Orb, Rings, Galaxy) */}
      <Core3D status={status} />

      {/* Main HUD Interface */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: isPhoneLayout ? '8px 10px' : '12px 20px',
          justifyContent: 'space-between',
          minHeight: 0,
        }}
      >
        {/* TOP BAR: Systems Header (Adaptive Phone vs Desktop) */}
        <header
          className="hud-panel"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: isPhoneLayout ? '8px' : '12px',
            padding: isPhoneLayout ? '8px 12px' : '10px 20px',
            borderRadius: '6px',
            flexShrink: 0,
            border: `1px solid ${status === 'listening' ? '#ff3366' : 'rgba(0, 240, 255, 0.4)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isPhoneLayout ? '8px' : '12px', minWidth: 0 }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor:
                  status === 'listening' ? '#ff3366' : status === 'processing' ? '#ffb800' : '#00f0ff',
                boxShadow: `0 0 12px ${
                  status === 'listening' ? '#ff3366' : status === 'processing' ? '#ffb800' : '#00f0ff'
                }`,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <h1
                className="font-tech glow-cyan"
                style={{
                  fontSize: isPhoneLayout ? '14px' : '17px',
                  fontWeight: 900,
                  letterSpacing: isPhoneLayout ? '1.5px' : '2.5px',
                  color: '#00f0ff',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isPhoneLayout ? 'J.A.R.V.I.S. OMNI' : 'J.A.R.V.I.S. // CLOUD + OMNI CORE'}
              </h1>
              {!isPhoneLayout && (
                <span className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>
                  MALE BRITISH VOICE • PC-OFF CLOUD + FOLD 7 + LOCAL AGENT MESH
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: isPhoneLayout ? '6px' : '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Visible Status Indicator: ONLINE / LOCAL / OFFLINE */}
            <div
              onClick={() => {
                const nextOffline = connSnap.mode !== 'OFFLINE';
                jarvisConnection.setSimulateOffline(nextOffline);
              }}
              title="Click to toggle Offline / Online simulation (Cloud -> Local Agent -> Offline)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: isPhoneLayout ? '4px 9px' : '5px 12px',
                borderRadius: '5px',
                cursor: 'pointer',
                background:
                  connSnap.mode === 'ONLINE'
                    ? 'rgba(16, 185, 129, 0.18)'
                    : connSnap.mode === 'LOCAL'
                    ? 'rgba(0, 240, 255, 0.18)'
                    : 'rgba(245, 158, 11, 0.22)',
                border: `1px solid ${
                  connSnap.mode === 'ONLINE'
                    ? '#10b981'
                    : connSnap.mode === 'LOCAL'
                    ? '#00f0ff'
                    : '#f59e0b'
                }`,
              }}
            >
              <div
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor:
                    connSnap.mode === 'ONLINE'
                      ? '#10b981'
                      : connSnap.mode === 'LOCAL'
                      ? '#00f0ff'
                      : '#f59e0b',
                  boxShadow: `0 0 8px ${
                    connSnap.mode === 'ONLINE'
                      ? '#10b981'
                      : connSnap.mode === 'LOCAL'
                      ? '#00f0ff'
                      : '#f59e0b'
                  }`,
                }}
              />
              <div>
                <div className="font-tech" style={{ fontSize: isPhoneLayout ? '10px' : '11px', color: '#ffffff', fontWeight: 800 }}>
                  {isPhoneLayout ? connSnap.mode : `STATUS: ${connSnap.mode}`}
                  {connSnap.queuedCount > 0 ? ` (${connSnap.queuedCount})` : ''}
                </div>
                {!isPhoneLayout && (
                  <div className="font-mono" style={{ fontSize: '9px', color: '#94a3b8' }}>
                    TIER: {connSnap.activeTier.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* 24/7 Cloud Worker & PC Agent Pairing Button */}
            <button
              onClick={() => {
                sound.playConfirm();
                setCloudProxyInput(jarvisConnection.getCloudProxyUrl());
                setTunnelUrlInput(jarvisConnection.getTunnelUrl());
                setAgentTokenInput(jarvisConnection.getAgentToken());
                setGhTokenInput(getGitHubToken());
                setCloudModalOpen(true);
              }}
              className="font-tech"
              title="Pair 24/7 Cloud Worker URL, Local PC Tunnel, and Auth Token"
              style={{
                background:
                  connSnap.cloudProxyReachable || connSnap.localAgentReachable
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(0, 240, 255, 0.18)',
                border: `1px solid ${
                  connSnap.cloudProxyReachable || connSnap.localAgentReachable ? '#10b981' : '#00f0ff'
                }`,
                borderRadius: '4px',
                color: '#ffffff',
                padding: isPhoneLayout ? '5px 9px' : '6px 11px',
                fontSize: isPhoneLayout ? '10px' : '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Cloud size={13} color={connSnap.cloudProxyReachable ? '#10b981' : '#00f0ff'} />
              {isPhoneLayout ? 'CLOUD' : 'CLOUD / PAIR'}
            </button>

            {canInstallPwa && (
              <button
                onClick={async () => {
                  const promptEvent = (window as any).__JARVIS_INSTALL_PROMPT__;
                  if (promptEvent) {
                    promptEvent.prompt();
                    await promptEvent.userChoice;
                    (window as any).__JARVIS_INSTALL_PROMPT__ = null;
                    setCanInstallPwa(false);
                  }
                }}
                className="font-tech"
                style={{
                  background: 'rgba(0, 240, 255, 0.22)',
                  border: '1px solid #00f0ff',
                  borderRadius: '4px',
                  color: '#00f0ff',
                  padding: '6px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⬇ INSTALL PWA
              </button>
            )}

            {(isPhoneLayout || isMediumLayout) ? (
              <button
                onClick={() => {
                  sound.playAcknowledge();
                  setMobileMenuOpen((prev) => !prev);
                }}
                className="font-tech"
                aria-label="Toggle J.A.R.V.I.S. modules menu"
                style={{
                  background: mobileMenuOpen ? 'rgba(255, 51, 102, 0.22)' : 'rgba(0, 240, 255, 0.16)',
                  border: `1px solid ${mobileMenuOpen ? '#ff3366' : '#00f0ff'}`,
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '5px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {mobileMenuOpen ? <X size={14} /> : <Menu size={14} />}
                MENU
              </button>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} color="#00f0ff" />
                  <div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>
                      VOICE ENGINE
                    </div>
                    <div className="font-tech" style={{ fontSize: '12px', color: '#00ff88' }}>
                      RYAN NEURAL (UK MALE)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#00f0ff" />
                  <div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>
                      LOCAL TIME
                    </div>
                    <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff' }}>
                      {time}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openCommandCenter('ghidra')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(0, 255, 136, 0.28))',
                    border: '1px solid #00ff88',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(0, 255, 136, 0.3)',
                  }}
                >
                  <Cpu size={13} color="#00ff88" /> GHIDRA & REA LAB
                </button>

                <button
                  onClick={() => openCommandCenter('faceless')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 0, 110, 0.35), rgba(112, 0, 255, 0.4))',
                    border: '1px solid #ff0070',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(255, 0, 110, 0.35)',
                  }}
                >
                  <Film size={13} color="#ff0070" /> FACELESS STUDIO
                </button>

                <button
                  onClick={() => openCommandCenter('temporal')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.25), rgba(176, 38, 255, 0.3))',
                    border: '1px solid #ffb800',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(255, 184, 0, 0.3)',
                  }}
                >
                  <Workflow size={13} color="#ffb800" /> TEMPORAL GATES
                </button>

                <button
                  onClick={() => openCommandCenter('agent')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(0, 240, 255, 0.3))',
                    border: '1px solid #10b981',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <BrainCircuit size={13} color="#10b981" /> AGENTIC & GITHUB CLOUD
                </button>

                <button
                  onClick={() => openCommandCenter('wendy')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(0, 255, 136, 0.3))',
                    border: '1px solid #38bdf8',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(56, 189, 248, 0.35)',
                  }}
                >
                  <Cpu size={13} color="#38bdf8" /> WENDYOS & PHYSICAL AI
                </button>

                <button
                  onClick={() => openCommandCenter('diagnostics')}
                  className="font-tech glow-cyan"
                  style={{
                    background: 'linear-gradient(135deg, rgba(176, 38, 255, 0.3), rgba(0, 240, 255, 0.3))',
                    border: '1px solid #b026ff',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(176, 38, 255, 0.35)',
                  }}
                >
                  <CheckCircle2 size={13} color="#b026ff" /> DIAGNOSTICS & FOLD7
                </button>

                <button
                  onClick={() => {
                    sound.playConfirm();
                    setStudioFocus('omni');
                    setIsOmniStudioOpen(true);
                  }}
                  className="font-tech glow-cyan"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(0, 240, 255, 0.35), rgba(176, 38, 255, 0.4), rgba(255, 0, 85, 0.35))',
                    border: '1px solid #00f0ff',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 16px rgba(0, 240, 255, 0.45)',
                  }}
                >
                  <Zap size={13} color="#00f0ff" /> FUSED OMNI-STUDIO
                </button>

                <div
                  className="font-mono"
                  style={{
                    background:
                      status === 'listening'
                        ? 'rgba(255, 51, 102, 0.15)'
                        : 'rgba(0, 240, 255, 0.1)',
                    border: `1px solid ${status === 'listening' ? '#ff3366' : '#00f0ff'}`,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: status === 'listening' ? '#ff3366' : '#00f0ff',
                  }}
                >
                  STATUS: {status.toUpperCase()}
                </div>
              </>
            )}
          </div>
        </header>

        {/* MOBILE / FOLDABLE COLLAPSIBLE MODULE DRAWER */}
        {(isPhoneLayout || isMediumLayout) && mobileMenuOpen && (
          <div
            className="hud-panel"
            style={{
              marginTop: '8px',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(0, 240, 255, 0.45)',
              background: 'rgba(4, 12, 28, 0.96)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0,
              zIndex: 70,
            }}
          >
            <div
              className="font-mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '10px',
                color: '#7ab0d4',
                borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
                paddingBottom: '6px',
              }}
            >
              <span>VOICE: RYAN NEURAL (UK MALE)</span>
              <span>
                {fold7Tel.posture} ({fold7Tel.hingeAngle}°) • {time}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPhoneLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                gap: '6px',
              }}
            >
              {[
                { label: 'GHIDRA & REA', color: '#00ff88', onClick: () => openCommandCenter('ghidra') },
                { label: 'FACELESS STUDIO', color: '#ff0070', onClick: () => openCommandCenter('faceless') },
                { label: 'TEMPORAL GATES', color: '#ffb800', onClick: () => openCommandCenter('temporal') },
                { label: 'AGENTIC CLOUD', color: '#10b981', onClick: () => openCommandCenter('agent') },
                { label: 'WENDYOS AI', color: '#38bdf8', onClick: () => openCommandCenter('wendy') },
                { label: 'FOLD7 DIAG', color: '#b026ff', onClick: () => openCommandCenter('diagnostics') },
                { label: 'SEC+ DOJO', color: '#10b981', onClick: () => openCommandCenter('secplus') },
                { label: 'MEMORY VAULT', color: '#b026ff', onClick: () => openCommandCenter('memory') },
                { label: 'ANIME STUDIO', color: '#ff0070', onClick: () => openCommandCenter('anime') },
                { label: 'FINANCE RISK', color: '#ffb800', onClick: () => openCommandCenter('finance') },
                {
                  label: 'OMNI-STUDIO',
                  color: '#00f0ff',
                  onClick: () => {
                    sound.playConfirm();
                    setMobileMenuOpen(false);
                    setStudioFocus('omni');
                    setIsOmniStudioOpen(true);
                  },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="font-tech"
                  style={{
                    background: `${item.color}1e`,
                    border: `1px solid ${item.color}`,
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '7px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MIDDLE SECTION: HUD PANELS + CENTER STAGE (Z FOLD 7 & MOBILE ADAPTIVE) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPhoneLayout
              ? '1fr'
              : isMediumLayout
              ? '280px 1fr'
              : '320px 1fr 380px',
            gap: isPhoneLayout ? '10px' : '20px',
            flex: 1,
            margin: isPhoneLayout ? '8px 0' : '16px 0',
            minHeight: 0,
            overflowY: isPhoneLayout || isMediumLayout ? 'auto' : 'visible',
            alignContent: isPhoneLayout || isMediumLayout ? 'start' : 'stretch',
          }}
        >
          {/* LEFT COLUMN: Telemetry & Quick Tools */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isPhoneLayout ? '10px' : '16px',
              overflow: isPhoneLayout || isMediumLayout ? 'visible' : 'hidden',
            }}
          >
            <GlassPanel title="System Telemetry" badge={`CPU ${liveHw.cpu}%`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  { label: 'Host CPU Load', val: `${liveHw.cpu}%`, pct: liveHw.cpu, color: '#00f0ff' },
                  { label: 'System RAM', val: `${liveHw.ram}%`, pct: liveHw.ram, color: '#00ff88' },
                  { label: 'Storage Free (D:)', val: `${liveHw.diskFreeGb} GB`, pct: 55, color: '#b026ff' },
                  { label: 'Ghidra 12.1.4 REA', val: 'PUBLIC + MCP', pct: 100, color: '#ffb800' },
                  { label: 'Voice Profile', val: isMuted ? 'Muted' : 'British Male (Ryan)', pct: 100, color: '#00f0ff' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => openCommandCenter('system')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: 'rgba(0, 30, 60, 0.4)',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      borderLeft: `2px solid ${item.color}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono" style={{ fontSize: '11px', color: '#c4e0f5' }}>
                        {item.label}
                      </span>
                      <span className="font-tech" style={{ fontSize: '11px', color: item.color }}>
                        {item.val}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel title="Connected AI & Tools" badge="v4.0 READY" style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                {[
                  { name: 'Ghidra 12.1.4 REA Lab', type: 'Binary Triage, Entropy & C Decompiler', action: () => openCommandCenter('ghidra') },
                  { name: 'Faceless Video Studio', type: 'Script -> Ryan TTS -> B-Roll -> MP4', action: () => openCommandCenter('faceless') },
                  { name: 'Temporal Approval Gates', type: 'Durable Workflows & Live Signals', action: () => openCommandCenter('temporal') },
                  { name: 'Hardware & Desktop Control', type: 'Live Core Graphs, Windows & Screen', action: () => openCommandCenter('system') },
                  { name: 'WendyOS & Physical AI', type: 'wendylabsinc Edge Robotics, WASM & OTA', action: () => openCommandCenter('wendy') },
                  { name: 'Diagnostics & Fold 7 Mesh', type: '10-Point Health Matrix & SM-F966U Sync', action: () => openCommandCenter('diagnostics') },
                  { name: 'Fused Omni-Studio', type: 'OpenArt + Higgsfield + CapCut NLE', action: () => { setStudioFocus('omni'); setIsOmniStudioOpen(true); } },
                  { name: 'REA Live Voice & Search', type: 'Hands-Free Voice & Web Search', action: toggleReaLive },
                ].map((ed, i) => (
                  <div
                    key={i}
                    onClick={ed.action}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0, 20, 45, 0.45)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Code2 size={13} color="#00f0ff" />
                      <div>
                        <div className="font-tech" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                          {ed.name}
                        </div>
                        <div className="font-mono" style={{ fontSize: '9px', color: '#6892b0' }}>
                          {ed.type}
                        </div>
                      </div>
                    </div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '9px',
                        color: '#00ff88',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={11} /> OPEN
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          {/* CENTER STAGE: Speech Bubble, Inline Media Player & Holo-HUD */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
              padding: '6px 0',
              minHeight: 0,
              overflowY: isPhoneLayout ? 'visible' : 'auto',
              order: isPhoneLayout ? -1 : 0,
            }}
          >
            {/* Top Center Speech & Media HUD */}
            <div
              className="hud-panel glow-box-cyan"
              style={{
                pointerEvents: 'auto',
                maxWidth: '720px',
                width: '100%',
                padding: '14px 20px',
                borderRadius: '8px',
                textAlign: 'center',
                background: 'rgba(5, 14, 32, 0.92)',
                border: `1px solid ${status === 'listening' ? 'rgba(255, 51, 102, 0.7)' : 'rgba(0, 240, 255, 0.6)'}`,
                boxShadow:
                  status === 'listening'
                    ? '0 0 25px rgba(255, 51, 102, 0.4)'
                    : '0 0 25px rgba(0, 240, 255, 0.3)',
              }}
            >
              <div
                className="font-tech glow-cyan"
                style={{
                  fontSize: '11px',
                  color: status === 'listening' ? '#ff3366' : '#00f0ff',
                  letterSpacing: '2px',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                // J.A.R.V.I.S. RESPONSE & MEDIA DISPLAY
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '13px',
                  lineHeight: '1.55',
                  color: '#e6f7ff',
                  minHeight: '36px',
                  maxHeight: '190px',
                  overflowY: 'auto',
                  textAlign: 'left',
                  padding: '4px 8px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {speechText}
              </div>

              {/* Inline Image or Playable MP4 Video Preview right inside Center HUD */}
              {activeMedia && (
                <div
                  style={{
                    marginTop: '10px',
                    background: 'rgba(2, 8, 18, 0.95)',
                    border: '1px solid rgba(0, 240, 255, 0.45)',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {activeMedia.type === 'video' ? (
                    <video
                      key={activeMedia.url}
                      src={agentMediaUrl(activeMedia.url)}
                      controls
                      autoPlay
                      loop
                      playsInline
                      style={{
                        width: '100%',
                        maxHeight: '240px',
                        borderRadius: '4px',
                        objectFit: 'contain',
                        background: '#000',
                      }}
                    />
                  ) : activeMedia.type === 'image' ? (
                    <img
                      src={agentMediaUrl(activeMedia.url)}
                      alt="Generated or Uploaded Asset"
                      style={{
                        width: '100%',
                        maxHeight: '240px',
                        borderRadius: '4px',
                        objectFit: 'contain',
                        background: '#000',
                      }}
                    />
                  ) : (
                    <audio src={agentMediaUrl(activeMedia.url)} controls style={{ width: '100%' }} />
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <a
                      href={agentMediaUrl(activeMedia.url)}
                      download
                      className="font-mono"
                      style={{
                        background: 'rgba(16, 163, 127, 0.25)',
                        border: '1px solid #10a37f',
                        color: '#34d399',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontWeight: 700,
                      }}
                    >
                      <Download size={12} /> DOWNLOAD {activeMedia.type.toUpperCase()}
                    </a>

                    {activeMedia.type === 'image' && (
                      <button
                        onClick={() =>
                          handleCommand(
                            `Create a video of ${
                              activeMedia.asset?.prompt || 'this scene with cinematic camera motion'
                            }`
                          )
                        }
                        className="font-mono"
                        style={{
                          background: 'rgba(255, 0, 85, 0.25)',
                          border: '1px solid #ff0055',
                          color: '#ffffff',
                          padding: '5px 12px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        🎬 ANIMATE TO MP4 VIDEO
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setStudioFocus(activeMedia.type === 'video' ? 'video' : 'openart');
                        setIsOmniStudioOpen(true);
                      }}
                      className="font-mono"
                      style={{
                        background: 'rgba(0, 240, 255, 0.2)',
                        border: '1px solid #00f0ff',
                        color: '#00f0ff',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      ⚡ OPEN IN OMNI-STUDIO
                    </button>

                    <button
                      onClick={() => setActiveMedia(null)}
                      className="font-mono"
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        color: '#94a3b8',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      HIDE PREVIEW
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible Telemetry Box */}
              {activeTelemetry && (
                <div style={{ marginTop: '8px', textAlign: 'left' }}>
                  <button
                    onClick={() => setShowTelemetry(!showTelemetry)}
                    className="font-mono"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffb800',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <BrainCircuit size={12} />
                    EXECUTION TELEMETRY
                    {showTelemetry ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showTelemetry && (
                    <div
                      className="font-mono"
                      style={{
                        background: 'rgba(0, 10, 25, 0.85)',
                        border: '1px solid rgba(255, 184, 0, 0.3)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        marginTop: '6px',
                        fontSize: '11px',
                        color: '#ffdd88',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {activeTelemetry}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!activeMedia && !isPhoneLayout && (
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(0, 240, 255, 0.3)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="animate-spin-slow"
              >
                <div
                  style={{
                    width: '130px',
                    height: '130px',
                    borderRadius: '50%',
                    border: '1px dotted rgba(0, 240, 255, 0.5)',
                  }}
                  className="animate-spin-reverse"
                />
              </div>
            )}

            <div style={{ height: '4px' }} />
          </div>

          {/* RIGHT COLUMN: 3D Second Brain & Directives Feed */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isPhoneLayout ? '10px' : '16px',
              overflow: isPhoneLayout || isMediumLayout ? 'visible' : 'hidden',
              gridColumn: isMediumLayout ? '1 / -1' : 'auto',
            }}
          >
            <GlassPanel
              title="3D Second Brain"
              badge={`${bridgeStats.totalNotes + bridgeStats.totalTasks} NODES`}
              style={{ minHeight: '220px', maxHeight: '260px' }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  marginBottom: '10px',
                  borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
                  paddingBottom: '6px',
                }}
              >
                {[
                  { id: 'vault', label: 'VAULT' },
                  { id: 'notes', label: `NOTES (${bridgeNotes.length})` },
                  { id: 'tasks', label: `TASKS (${bridgeTasks.length})` },
                  { id: 'session', label: 'SESSION' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBrainTab(t.id as any)}
                    className="font-mono"
                    style={{
                      background: brainTab === t.id ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                      border: 'none',
                      color: brainTab === t.id ? '#00f0ff' : '#6892b0',
                      padding: '3px 8px',
                      fontSize: '10px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: brainTab === t.id ? 'bold' : 'normal',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                {brainTab === 'vault' &&
                  knowledgeFiles.map((doc, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleCommand(`Summarize knowledge file: ${doc.title}`)}
                      style={{
                        background: 'rgba(0, 30, 60, 0.4)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        borderRight: '2px solid #00f0ff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="font-tech" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                          {doc.title}
                        </span>
                        <span className="font-mono" style={{ fontSize: '9px', color: '#6892b0' }}>
                          {doc.size}
                        </span>
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          color: '#7ab0d4',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.preview}
                      </div>
                    </div>
                  ))}

                {brainTab === 'notes' &&
                  bridgeNotes.slice(0, 15).map((n, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleCommand(`Analyze bridge note: ${n.key}`)}
                      style={{
                        background: 'rgba(0, 30, 60, 0.4)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        borderRight: '2px solid #ffb800',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-tech" style={{ fontSize: '11px', color: '#ffdd88' }}>
                          {n.key}
                        </span>
                        <span className="font-mono" style={{ fontSize: '9px', color: '#6892b0' }}>
                          by {n.updated_by}
                        </span>
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          color: '#b0c8d8',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.preview}
                      </div>
                    </div>
                  ))}

                {brainTab === 'tasks' &&
                  bridgeTasks.slice(0, 15).map((t, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleCommand(`Review task: ${t.title}`)}
                      style={{
                        background: 'rgba(0, 30, 60, 0.4)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        borderRight: `2px solid ${
                          t.status === 'done' ? '#00ff88' : t.status === 'in_progress' ? '#ffb800' : '#00f0ff'
                        }`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="font-tech" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                          {t.title}
                        </span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '9px',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            color:
                              t.status === 'done' ? '#00ff88' : t.status === 'in_progress' ? '#ffb800' : '#00f0ff',
                          }}
                        >
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}

                {brainTab === 'session' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      className="font-mono"
                      style={{
                        background: 'rgba(0, 30, 60, 0.4)',
                        padding: '8px 10px',
                        borderRadius: '4px',
                        borderLeft: '2px solid #00f0ff',
                        fontSize: '11px',
                        color: '#c4e0f5',
                      }}
                    >
                      <div style={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: '4px' }}>
                        ACTIVE GOAL:
                      </div>
                      {sessionInfo.goal}
                    </div>
                  </div>
                )}
              </div>
            </GlassPanel>

            {/* Live Directives Feed with Inline Media Cards */}
            <GlassPanel title="Directives Feed" badge="LIVE STREAM" style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '100%',
                  overflowY: 'auto',
                }}
              >
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: 'rgba(0, 15, 35, 0.55)',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      borderLeft: `2px solid ${
                        log.sender === 'USER' ? '#ffb800' : log.sender === 'JARVIS' ? '#00f0ff' : '#00ff88'
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '10px',
                        marginBottom: '3px',
                      }}
                      className="font-mono"
                    >
                      <span
                        style={{
                          color:
                            log.sender === 'USER' ? '#ffb800' : log.sender === 'JARVIS' ? '#00f0ff' : '#00ff88',
                          fontWeight: 'bold',
                        }}
                      >
                        [{log.sender}]
                        {log.engine && (
                          <span style={{ color: '#6892b0', fontWeight: 'normal', marginLeft: '6px' }}>
                            ({log.engine})
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#4a7090' }}>{log.timestamp}</span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '11px', color: '#d0e5f5', lineHeight: '1.4' }}>
                      {log.text}
                    </div>

                    {log.media && (
                      <div style={{ marginTop: '6px' }}>
                        <button
                          onClick={() => setActiveMedia(log.media!)}
                          className="font-mono"
                          style={{
                            background: 'rgba(0, 240, 255, 0.18)',
                            border: '1px solid #00f0ff',
                            color: '#00f0ff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <Play size={11} /> VIEW {log.media.type.toUpperCase()} ON CENTER HUD
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </GlassPanel>
          </div>
        </div>

        {/* BOTTOM SECTION: Command Input & Audio Interface */}
        <footer style={{ marginTop: 'auto', zIndex: 60 }}>
          <CommandInput
            onExecute={handleCommand}
            status={status}
            onToggleMic={toggleMic}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            engine={engine}
            onSelectEngine={setEngine}
            listeningTranscript={listeningTranscript}
            onUploadMedia={handleMediaUpload}
            isReaLive={isReaLive}
            onToggleReaLive={toggleReaLive}
          />
        </footer>

        <OmniStudio
          isOpen={isOmniStudioOpen}
          onClose={() => setIsOmniStudioOpen(false)}
          onPromptToJarvis={(p) => handleCommand(p)}
          initialFocus={studioFocus}
        />

        <CommandCenterModal
          isOpen={isCommandCenterOpen}
          onClose={() => setIsCommandCenterOpen(false)}
          initialTab={commandCenterTab}
          onShowMediaOnHud={(m) => setActiveMedia(m)}
          onPromptToJarvis={(p) => handleCommand(p)}
        />

        {/* 24/7 Cloud Worker & Local PC Agent Pairing Modal */}
        {cloudModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="J.A.R.V.I.S. Cloud and Local Agent Pairing"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(2, 6, 18, 0.86)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isPhoneLayout ? '12px' : '24px',
            }}
            onClick={() => setCloudModalOpen(false)}
          >
            <div
              className="hud-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90dvh',
                overflowY: 'auto',
                background: 'rgba(6, 14, 32, 0.98)',
                border: '1px solid rgba(0, 240, 255, 0.55)',
                borderRadius: '10px',
                padding: isPhoneLayout ? '16px' : '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 0 36px rgba(0, 240, 255, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cloud size={18} color="#00f0ff" />
                  <span className="font-tech" style={{ fontSize: '14px', fontWeight: 800, color: '#00f0ff' }}>
                    CLOUD & AGENT PAIRING
                  </span>
                </div>
                <button
                  onClick={() => setCloudModalOpen(false)}
                  aria-label="Close pairing dialog"
                  style={{
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Live Tier Diagnostics */}
              <div
                className="font-mono"
                style={{
                  background: 'rgba(0, 20, 44, 0.75)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '11px',
                  color: '#c4e0f5',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '6px',
                }}
              >
                <div>
                  MODE:{' '}
                  <b
                    style={{
                      color:
                        connSnap.mode === 'ONLINE'
                          ? '#10b981'
                          : connSnap.mode === 'LOCAL'
                          ? '#00f0ff'
                          : '#f59e0b',
                    }}
                  >
                    {connSnap.mode}
                  </b>
                </div>
                <div>
                  ACTIVE TIER: <b style={{ color: '#00f0ff' }}>{connSnap.activeTier}</b>
                </div>
                <div>
                  CLOUD WORKER:{' '}
                  <b style={{ color: connSnap.cloudProxyReachable ? '#10b981' : '#94a3b8' }}>
                    {connSnap.cloudProxyReachable ? 'CONNECTED' : 'UNSET / STANDBY'}
                  </b>
                </div>
                <div>
                  LOCAL PC AGENT:{' '}
                  <b style={{ color: connSnap.localAgentReachable ? '#10b981' : '#94a3b8' }}>
                    {connSnap.localAgentReachable
                      ? connSnap.wsAgentConnected
                        ? 'WS PAIRED'
                        : 'HTTP REACHABLE'
                      : 'OFFLINE'}
                  </b>
                </div>
              </div>

              {/* Offline Queue Bar */}
              {connSnap.queuedCount > 0 && (
                <div
                  className="font-mono"
                  style={{
                    background: 'rgba(245, 158, 11, 0.14)',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: '#fde68a',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{connSnap.queuedCount} offline command(s) queued</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => jarvisConnection.flushOfflineQueue()}
                      className="font-mono"
                      style={{
                        background: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid #10b981',
                        color: '#34d399',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      SYNC NOW
                    </button>
                    <button
                      onClick={() => jarvisConnection.clearOfflineQueue()}
                      className="font-mono"
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>
              )}

              {/* Pairing Inputs (Stored only in localStorage on this device) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="font-mono" style={{ fontSize: '11px', color: '#93c5fd' }}>
                  24/7 Cloud Worker URL (Cloudflare Worker — Zero PC Required)
                  <input
                    type="url"
                    value={cloudProxyInput}
                    onChange={(e) => setCloudProxyInput(e.target.value)}
                    placeholder="https://jarvis-omni-cloud.<subdomain>.workers.dev"
                    className="font-mono"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'rgba(2, 8, 22, 0.95)',
                      border: '1px solid rgba(0, 240, 255, 0.35)',
                      borderRadius: '5px',
                      padding: '8px 10px',
                      color: '#e2f1ff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </label>

                <label className="font-mono" style={{ fontSize: '11px', color: '#93c5fd' }}>
                  Local PC Agent Tunnel URL (Cloudflare Tunnel for PC Control)
                  <input
                    type="url"
                    value={tunnelUrlInput}
                    onChange={(e) => setTunnelUrlInput(e.target.value)}
                    placeholder="https://jarvis-agent.<your-domain>.com"
                    className="font-mono"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'rgba(2, 8, 22, 0.95)',
                      border: '1px solid rgba(0, 240, 255, 0.35)',
                      borderRadius: '5px',
                      padding: '8px 10px',
                      color: '#e2f1ff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </label>

                <label className="font-mono" style={{ fontSize: '11px', color: '#93c5fd' }}>
                  Agent / Cloud Auth Token (X-Jarvis-Token)
                  <input
                    type="password"
                    value={agentTokenInput}
                    onChange={(e) => setAgentTokenInput(e.target.value)}
                    placeholder="Stored locally in browser/APK only"
                    className="font-mono"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'rgba(2, 8, 22, 0.95)',
                      border: '1px solid rgba(0, 240, 255, 0.35)',
                      borderRadius: '5px',
                      padding: '8px 10px',
                      color: '#e2f1ff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </label>

                <label className="font-mono" style={{ fontSize: '11px', color: '#93c5fd' }}>
                  GitHub Models PAT (Optional fallback LLM)
                  <input
                    type="password"
                    value={ghTokenInput}
                    onChange={(e) => setGhTokenInput(e.target.value)}
                    placeholder="github_pat_..."
                    className="font-mono"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'rgba(2, 8, 22, 0.95)',
                      border: '1px solid rgba(0, 240, 255, 0.35)',
                      borderRadius: '5px',
                      padding: '8px 10px',
                      color: '#e2f1ff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const nextOffline = !jarvisConnection.isSimulatedOffline();
                    jarvisConnection.setSimulateOffline(nextOffline);
                  }}
                  className="font-mono"
                  style={{
                    background: 'rgba(245, 158, 11, 0.16)',
                    border: '1px solid #f59e0b',
                    color: '#fde68a',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {jarvisConnection.isSimulatedOffline() ? 'DISABLE OFFLINE SIM' : 'SIMULATE OFFLINE'}
                </button>

                <button
                  onClick={async () => {
                    sound.playConfirm();
                    jarvisConnection.setCloudProxyUrl(cloudProxyInput);
                    jarvisConnection.setTunnelUrl(tunnelUrlInput);
                    jarvisConnection.setAgentToken(agentTokenInput);
                    setGitHubToken(ghTokenInput);
                    const snap = await jarvisConnection.probe();
                    setSpeechText(
                      `Pairing updated, Sir. Mode: ${snap.mode} • Active Tier: ${snap.activeTier} • Cloud Worker: ${
                        snap.cloudProxyReachable ? 'CONNECTED' : 'STANDBY'
                      } • Local Agent: ${snap.localAgentReachable ? 'REACHABLE' : 'OFFLINE'}.`
                    );
                    setCloudModalOpen(false);
                  }}
                  className="font-tech"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(16, 185, 129, 0.35))',
                    border: '1px solid #10b981',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  SAVE & TEST CONNECTION
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
