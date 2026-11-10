import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Sparkles, Volume2, VolumeX, Cpu, Upload, Radio } from 'lucide-react';
import { sound } from '../utils/sound';

export type JarvisEngineType =
  | 'gemini-pro'
  | 'claude-code'
  | 'grok'
  | 'chatgpt'
  | 'codex'
  | 'council'
  | 'auto'
  | 'gemini'
  | 'claude'
  | 'local';

interface CommandInputProps {
  onExecute: (cmd: string) => void;
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  onToggleMic: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  engine: JarvisEngineType;
  onSelectEngine: (engine: JarvisEngineType) => void;
  listeningTranscript?: string;
  onUploadMedia?: (file: File) => void;
  isReaLive?: boolean;
  onToggleReaLive?: () => void;
}

const ENGINE_OPTIONS: { id: JarvisEngineType; label: string; color: string }[] = [
  { id: 'gemini-pro', label: 'GEMINI PRO [SOUL]', color: '#00f0ff' },
  { id: 'claude-code', label: 'CLAUDE CODE', color: '#ff9900' },
  { id: 'grok', label: 'GROK 4', color: '#ff0055' },
  { id: 'chatgpt', label: 'CHATGPT', color: '#10a37f' },
  { id: 'codex', label: 'CODEX CLI', color: '#a855f7' },
  { id: 'council', label: 'OMNI-COUNCIL', color: '#facc15' },
];

export const CommandInput: React.FC<CommandInputProps> = ({
  onExecute,
  status,
  onToggleMic,
  isMuted,
  onToggleMute,
  engine,
  onSelectEngine,
  listeningTranscript = '',
  onUploadMedia,
  isReaLive = false,
  onToggleReaLive,
}) => {
  const [text, setText] = useState('');
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (listeningTranscript && status === 'listening') {
      setText(listeningTranscript);
    }
  }, [listeningTranscript, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sound.playAcknowledge();
    onExecute(text);
    setText('');
  };

  const quickActions = [
    { label: '🎨 Create Image', cmd: 'Create an image of a futuristic Stark Mark IX armor in Neo-Tokyo 4K' },
    { label: '🎬 Create Video', cmd: 'Create a video of a glowing blue Arc Reactor core spinning with energy' },
    { label: '🌐 Deep Research (REA)', cmd: 'Research the latest breakthroughs in autonomous AI agents' },
    { label: '⚡ Open Omni-Studio', cmd: 'Open Omni-Studio' },
    { label: '🩺 System Diagnostics', cmd: 'Run Diagnostics' },
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1040px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Hidden File Upload Input */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onUploadMedia) {
            onUploadMedia(file);
          }
          if (uploadInputRef.current) uploadInputRef.current.value = '';
        }}
      />

      {/* Top Row: Quick Action Pills + REA Live Mode + Multi-Model Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          gap: '8px',
          padding: '2px 4px',
          scrollbarWidth: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 }}>
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                sound.playAcknowledge();
                onExecute(a.cmd);
              }}
              className="font-mono"
              style={{
                background: 'rgba(0, 30, 60, 0.72)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                color: '#00f0ff',
                padding: '4px 10px',
                fontSize: '10px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
              }}
            >
              <Sparkles size={10} /> {a.label}
            </button>
          ))}

          {onToggleReaLive && (
            <button
              type="button"
              onClick={() => {
                sound.playConfirm();
                onToggleReaLive();
              }}
              className="font-mono"
              style={{
                background: isReaLive ? 'rgba(255, 0, 85, 0.3)' : 'rgba(16, 163, 127, 0.2)',
                border: `1px solid ${isReaLive ? '#ff0055' : '#10a37f'}`,
                color: isReaLive ? '#ff6699' : '#34d399',
                padding: '4px 10px',
                fontSize: '10px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
                boxShadow: isReaLive ? '0 0 12px rgba(255, 0, 85, 0.4)' : 'none',
              }}
            >
              <Radio size={11} />
              {isReaLive ? 'REA LIVE VOICE: ON' : '🎙️ REA LIVE VOICE'}
            </button>
          )}
        </div>

        {/* Multi-Model & CLI Direct Selector Bar */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 }}>
          {ENGINE_OPTIONS.map((opt) => {
            const active =
              engine === opt.id ||
              (opt.id === 'gemini-pro' && (engine === 'auto' || engine === 'gemini'));
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  sound.playScanTone();
                  onSelectEngine(opt.id);
                }}
                className="font-mono"
                style={{
                  background: active ? `${opt.color}25` : 'rgba(5, 14, 28, 0.85)',
                  border: `1px solid ${active ? opt.color : 'rgba(100, 140, 180, 0.25)'}`,
                  color: active ? opt.color : '#7c9ab8',
                  padding: '3px 8px',
                  fontSize: '9px',
                  fontWeight: active ? 700 : 500,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: active ? `0 0 8px ${opt.color}40` : 'none',
                }}
              >
                <Cpu size={10} /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Prompt Input Box */}
      <form
        onSubmit={handleSubmit}
        className="hud-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 14px',
          gap: '10px',
          borderRadius: '28px',
          background: 'rgba(5, 12, 28, 0.92)',
          border: `1px solid ${status === 'listening' ? '#ff3366' : 'rgba(0, 240, 255, 0.5)'}`,
          boxShadow:
            status === 'listening'
              ? '0 0 25px rgba(255, 51, 102, 0.35)'
              : '0 0 20px rgba(0, 240, 255, 0.2)',
        }}
      >
        <button
          type="button"
          onClick={onToggleMic}
          title={status === 'listening' ? 'Stop voice capture' : 'Start voice capture'}
          style={{
            background:
              status === 'listening'
                ? 'rgba(255, 51, 102, 0.25)'
                : 'rgba(0, 240, 255, 0.12)',
            border: `1px solid ${status === 'listening' ? '#ff3366' : '#00f0ff'}`,
            color: status === 'listening' ? '#ff3366' : '#00f0ff',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Mic size={18} />
        </button>

        {/* Direct File Upload Button right inside the Command Bar */}
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          title="Upload any Image, Video, or Audio file"
          className="font-mono"
          style={{
            background: 'rgba(16, 163, 127, 0.22)',
            border: '1px solid #10a37f',
            color: '#34d399',
            padding: '6px 10px',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <Upload size={13} /> UPLOAD
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            status === 'listening'
              ? 'Listening on neural audio bus... Speak your directive, Sir.'
              : "Ask anything, or say 'Create an image of...', 'Create a video of...', 'Research...', or upload a file..."
          }
          className="font-mono"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e0f7ff',
            fontSize: '13px',
          }}
        />

        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute British Male Voice' : 'Mute British Male Voice'}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            color: isMuted ? '#ff3366' : '#00f0ff',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, #00f0ff, #0088ff)',
            border: 'none',
            color: '#020813',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: 'bold',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(0, 240, 255, 0.5)',
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
