import { agentMediaUrl } from '../utils/jarvisConfig';
import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Sparkles,
  Image as ImageIcon,
  Video,
  Layers,
  Sliders,
  Download,
  RefreshCw,
  Zap,
  CheckCircle2,
  Maximize2,
  Palette,
  Camera,
  Scissors,
  Eye,
  History,
  X,
} from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { sound } from '../utils/sound';

interface CreativeModel {
  id: string;
  name: string;
  provider: string;
  type: 'image' | 'video';
  badge: string;
  styles: string[];
}

interface CreativeAsset {
  id: string;
  prompt: string;
  model_id: string;
  style_preset: string;
  aspect_ratio: string;
  media_url: string;
  created_at: string;
}

interface CreativeStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptToJarvis?: (prompt: string) => void;
}

const DEFAULT_MODELS: CreativeModel[] = [
  {
    id: 'nano-banana-2-1',
    name: 'Nano Banana 2.1',
    provider: 'Google DeepMind / OpenArt',
    type: 'image',
    badge: '4K Native Detail',
    styles: ['Photorealistic', 'Studio Product', 'Cyberpunk', 'Cinematic 3D'],
  },
  {
    id: 'flux-3-image',
    name: 'FLUX 3 Image',
    provider: 'Black Forest Labs / OpenArt',
    type: 'image',
    badge: 'Highest Aesthetic',
    styles: ['Cinematic Neo-Tokyo', 'Hyperreal Portrait', 'Concept Art', 'Anime 2D'],
  },
  {
    id: 'gpt-image-2-5-flare',
    name: 'GPT Image 2.5 Flare',
    provider: 'OpenAI / OpenArt',
    type: 'image',
    badge: 'Fastest Layout & Text',
    styles: ['Digital Illustration', 'Graphic Poster', 'Vector Minimalist'],
  },
  {
    id: 'byte-plus-seedream-5-pro',
    name: 'Seedream 5 Pro',
    provider: 'ByteDance / OpenArt',
    type: 'image',
    badge: 'Anime & 2D Art Flagship',
    styles: ['Anime Masterpiece', 'Manga Cel Shade', 'Fantasy Concept'],
  },
  {
    id: 'wan2-7-image',
    name: 'Wan 2.7 Image',
    provider: 'Alibaba / OpenArt',
    type: 'image',
    badge: 'Face & Anatomy Focus',
    styles: ['Fashion Photography', 'Cinematic Film Still', 'Editorial Portrait'],
  },
  {
    id: 'kling-3-omni',
    name: 'Kling 3 Omni',
    provider: 'Kuaishou / OpenArt',
    type: 'video',
    badge: '4K Cinematic Motion',
    styles: ['Cinematic Camera Move', 'Dramatic Lighting', 'Slow Motion 60fps'],
  },
];

const STYLE_PRESETS = [
  'Cinematic Neo-Tokyo',
  'Anime Masterpiece',
  'Hyperreal Photography',
  'Octane 3D Render',
  'Cyberpunk Arc Reactor',
  'Concept Art Matte',
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9'];

export const CreativeStudio: React.FC<CreativeStudioProps> = ({ isOpen, onClose, onPromptToJarvis }) => {
  const [models, setModels] = useState<CreativeModel[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('flux-3-image');
  const [activeTool, setActiveTool] = useState<'text2image' | 'image2video' | 'inpaint' | 'bg_remover'>('text2image');
  const [prompt, setPrompt] = useState<string>(
    'Tony Stark holographic Arc Reactor design room, detailed glowing cyan wireframes, futuristic workshop'
  );
  const [selectedStyle, setSelectedStyle] = useState<string>('Cinematic Neo-Tokyo');
  const [selectedRatio, setSelectedRatio] = useState<string>('16:9');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentAsset, setCurrentAsset] = useState<CreativeAsset | null>(null);
  const [history, setHistory] = useState<CreativeAsset[]>([]);
  const [temporalStatus, setTemporalStatus] = useState<string>('DURABLE QUEUE ACTIVE');

  // Load models and history from backend
  const loadStudioData = async () => {
    try {
      const [mRes, hRes] = await Promise.all([
        fetch('/api/creative/models').catch(() => null),
        fetch('/api/creative/history').catch(() => null),
      ]);
      if (mRes && mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData) && mData.length > 0) setModels(mData);
      }
      if (hRes && hRes.ok) {
        const hData = await hRes.json();
        if (Array.isArray(hData) && hData.length > 0) {
          setHistory(hData);
          if (!currentAsset) setCurrentAsset(hData[0]);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStudioData();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    sound.playConfirm();

    try {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model_id: selectedModel,
          aspect_ratio: selectedRatio,
          style_preset: selectedStyle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.asset) {
          setCurrentAsset(data.asset);
          setHistory((prev) => [data.asset, ...prev]);
          sound.playScanTone();
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhancePrompt = () => {
    sound.playBeep();
    const enhancements = [
      '8k resolution, volumetric cyan illumination, photorealistic reflections, cinematic depth of field, hyper-detailed hard-surface geometry',
      'unreal engine 5 render, raytraced atmospheric fog, intricate circuit traces, masterpiece composition',
      'anamorphic lens flare, sharp focus, octane render studio lighting, ultra-high dynamic range',
    ];
    const picked = enhancements[Math.floor(Math.random() * enhancements.length)];
    setPrompt((prev) => `${prev.trim()}, ${picked}`);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 16, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 30px',
        color: '#e2f1ff',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top Navigation & Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 240, 255, 0.3)',
          paddingBottom: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #00f0ff, #7000ff)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              color: '#000',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} /> OPENART CREATIVE SUITE // RECREATED
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: '11px',
              color: '#00ff88',
              background: 'rgba(0, 255, 136, 0.15)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={13} /> {temporalStatus}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: '11px',
              color: '#ffb800',
              background: 'rgba(255, 184, 0, 0.12)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 184, 0, 0.3)',
            }}
          >
            CREDITS: 40 AVAILABLE (OpenArt Connected)
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 51, 102, 0.2)',
            border: '1px solid rgba(255, 51, 102, 0.4)',
            color: '#ff3366',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          <X size={15} /> EXIT SUITE
        </button>
      </div>

      {/* Main Studio Viewport: 3 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 320px',
          gap: '20px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Column: AI Apps & Tool Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Tool Selection */}
          <GlassPanel title="AI Creation Tools" badge="4 ACTIVE">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'text2image', label: 'Text to Image', icon: ImageIcon, desc: '4K Generative Canvas' },
                { id: 'image2video', label: 'Image to Video', icon: Video, desc: 'Motion & Cinematic Flow' },
                { id: 'inpaint', label: 'Magic Brush / Inpaint', icon: Wand2, desc: 'Targeted Object Edit' },
                { id: 'bg_remover', label: 'Background Remover', icon: Scissors, desc: 'Alpha Masking' },
              ].map((tool) => {
                const Icon = tool.icon;
                const isSelected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id as any);
                      sound.playBeep();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      background: isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 20, 40, 0.4)',
                      border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.1)',
                      borderRadius: '5px',
                      color: isSelected ? '#00f0ff' : '#9bbdd6',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={16} color={isSelected ? '#00f0ff' : '#6892b0'} />
                    <div>
                      <div className="font-tech" style={{ fontSize: '11px', fontWeight: isSelected ? 'bold' : 'normal' }}>
                        {tool.label}
                      </div>
                      <div className="font-mono" style={{ fontSize: '9px', color: '#6892b0' }}>
                        {tool.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* Model Dispatch Selector */}
          <GlassPanel title="Foundation Models" badge={`${models.length} LINKED`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {models.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      sound.playBeep();
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 10px',
                      background: isSelected ? 'rgba(112, 0, 255, 0.25)' : 'rgba(0, 20, 40, 0.4)',
                      border: isSelected ? '1px solid #7000ff' : '1px solid rgba(112, 0, 255, 0.15)',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-tech" style={{ fontSize: '11px', color: isSelected ? '#ffffff' : '#cce4f7' }}>
                        {m.name}
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '8px',
                          color: '#00f0ff',
                          background: 'rgba(0, 240, 255, 0.15)',
                          padding: '2px 4px',
                          borderRadius: '3px',
                        }}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <span className="font-mono" style={{ fontSize: '9px', color: '#6892b0', marginTop: '2px' }}>
                      {m.provider}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassPanel>
        </div>

        {/* Center Column: Live Viewport Canvas & Render Stage */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: 'rgba(0, 10, 25, 0.7)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '8px',
            padding: '16px',
            overflow: 'hidden',
          }}
        >
          {/* Viewport Canvas Stage */}
          <div
            style={{
              flex: 1,
              background: '#02070d',
              borderRadius: '6px',
              border: '1px dashed rgba(0, 240, 255, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {currentAsset ? (
              <img
                src={agentMediaUrl(currentAsset.media_url)}
                alt={currentAsset.prompt}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  boxShadow: '0 0 30px rgba(0, 240, 255, 0.25)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#6892b0' }}>
                <ImageIcon size={48} opacity={0.4} />
                <div className="font-mono" style={{ marginTop: '8px', fontSize: '12px' }}>
                  AWAITING GENERATION DIRECTIVE
                </div>
              </div>
            )}

            {isGenerating && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(2, 6, 16, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}
              >
                <RefreshCw size={36} color="#00f0ff" className="animate-spin" />
                <span className="font-tech" style={{ fontSize: '13px', color: '#00f0ff', letterSpacing: '2px' }}>
                  TEMPORAL DISPATCH // GENERATING 4K ARTWORK
                </span>
              </div>
            )}

            {/* Viewport Meta Badge Overlay */}
            {currentAsset && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(0, 10, 25, 0.85)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  fontSize: '10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#00f0ff',
                }}
              >
                MODEL: {currentAsset.model_id.toUpperCase()} | RATIO: {currentAsset.aspect_ratio} | STYLE:{' '}
                {currentAsset.style_preset}
              </div>
            )}
          </div>

          {/* Prompt & Generation Controls Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your creative vision in rich detail..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(0, 20, 40, 0.6)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleEnhancePrompt}
                title="Enhance prompt with J.A.R.V.I.S. Prompt Architect"
                style={{
                  position: 'absolute',
                  right: '10px',
                  bottom: '10px',
                  background: 'rgba(255, 184, 0, 0.2)',
                  border: '1px solid rgba(255, 184, 0, 0.4)',
                  color: '#ffb800',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} /> ENHANCE
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Aspect Ratio Selector */}
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSelectedRatio(ratio)}
                    style={{
                      background: selectedRatio === ratio ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 20, 40, 0.4)',
                      border: selectedRatio === ratio ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.15)',
                      color: selectedRatio === ratio ? '#00f0ff' : '#6892b0',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                    }}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{
                  background: isGenerating
                    ? 'rgba(0, 240, 255, 0.2)'
                    : 'linear-gradient(135deg, #00f0ff, #0088ff)',
                  border: 'none',
                  color: '#000000',
                  fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  padding: '8px 20px',
                  borderRadius: '5px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)',
                }}
              >
                <Zap size={15} /> GENERATE (TEMPORAL DISPATCH)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Style Presets & Generation History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Style Presets */}
          <GlassPanel title="Style Presets" badge="CURATED">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {STYLE_PRESETS.map((style) => {
                const isSelected = selectedStyle === style;
                return (
                  <button
                    key={style}
                    onClick={() => {
                      setSelectedStyle(style);
                      sound.playBeep();
                    }}
                    style={{
                      padding: '6px 8px',
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      background: isSelected ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 20, 40, 0.4)',
                      border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.1)',
                      color: isSelected ? '#00f0ff' : '#9bbdd6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* Asset Library & History */}
          <GlassPanel title="Creation History" badge={`${history.length} SAVED`} style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6892b0', fontSize: '11px' }}>
                  No previous assets generated.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentAsset(item);
                      sound.playBeep();
                    }}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '6px 8px',
                      background: currentAsset?.id === item.id ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 20, 40, 0.4)',
                      border:
                        currentAsset?.id === item.id ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.1)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={agentMediaUrl(item.media_url)}
                      alt={item.prompt}
                      style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '3px' }}
                    />
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div
                        className="font-tech"
                        style={{
                          fontSize: '10px',
                          color: '#e2f1ff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.prompt}
                      </div>
                      <div className="font-mono" style={{ fontSize: '9px', color: '#6892b0' }}>
                        {item.model_id} • {item.aspect_ratio}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};
