import { agentMediaUrl } from '../utils/jarvisConfig';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Film,
  Play,
  Pause,
  Scissors,
  Trash2,
  Download,
  FolderSync,
  Wand2,
  Video,
  Image as ImageIcon,
  X,
  Upload,
  Maximize2,
  Eraser,
  ArrowRight,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface OmniStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptToJarvis?: (prompt: string) => void;
  initialFocus?: 'omni' | 'openart' | 'video';
}

interface TimelineClip {
  id: string;
  name: string;
  track: 'video1' | 'video2' | 'audio1' | 'voice' | 'captions';
  startTime: number;
  duration: number;
  color: string;
  sourceUrl?: string;
  model?: string;
  cameraMotion?: string;
  speed?: number;
}

export const OmniStudio: React.FC<OmniStudioProps> = ({
  isOpen,
  onClose,
  onPromptToJarvis,
  initialFocus = 'omni',
}) => {
  // Master Creative Prompt & Controls
  const [masterPrompt, setMasterPrompt] = useState(
    'Stark Industries Mark IX Cybernetic Samurai standing in neon rain, Neo-Tokyo 4K'
  );
  const [openartModel, setOpenartModel] = useState('nano-banana-2-1');
  const [openartStyle, setOpenartStyle] = useState('Cyberpunk');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [hfModel, setHfModel] = useState('veo3_1');
  const [cameraMotion, setCameraMotion] = useState('Dolly In');
  const [projectName, setProjectName] = useState('JARVIS_Omni_Master');
  const [isFusing, setIsFusing] = useState(false);
  const [statusBanner, setStatusBanner] = useState(
    'READY // Create Images, Generate MP4 Videos, Upload Media, Edit with AI Tools, or Render Full Timeline.'
  );

  // Monitor View Mode: 'video' or 'image'
  const [monitorMode, setMonitorMode] = useState<'video' | 'image'>('video');

  // OpenArt Image State
  const [openartHistory, setOpenartHistory] = useState<any[]>([]);
  const [activeKeyframeUrl, setActiveKeyframeUrl] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState<string | null>(null);

  // Higgsfield & Video State
  const [hfAccount, setHfAccount] = useState<any>(null);
  const [hfModels, setHfModels] = useState<any[]>([]);
  const [videoHistory, setVideoHistory] = useState<any[]>([]);
  const [hfSearch, setHfSearch] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isRenderingTimeline, setIsRenderingTimeline] = useState(false);

  // Uploads State
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // CapCut & NLE Timeline State
  const [capcutDrafts, setCapcutDrafts] = useState<any[]>([]);
  const [playhead, setPlayhead] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClipId, setSelectedClipId] = useState<string>('clip-init-1');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string>('');
  const [clips, setClips] = useState<TimelineClip[]>([
    {
      id: 'clip-init-1',
      name: 'Scene 01: OpenArt Cinema MP4',
      track: 'video1',
      startTime: 0,
      duration: 6,
      color: '#00f0ff',
      sourceUrl: '/api/video/stream/openart_vid_8cPwVW3j.mp4',
      model: 'veo3_1',
      cameraMotion: 'Dolly In',
      speed: 1.0,
    },
    {
      id: 'clip-init-2',
      name: 'Scene 02: Action Sequence MP4',
      track: 'video1',
      startTime: 6,
      duration: 6,
      color: '#ff0055',
      sourceUrl: '/api/video/stream/openart_vid_3fWuo5GF.mp4',
      model: 'kling4_0',
      cameraMotion: 'Pan Right',
      speed: 1.0,
    },
    {
      id: 'clip-init-3',
      name: 'OpenArt Keyframe Overlay',
      track: 'video2',
      startTime: 2,
      duration: 6,
      color: '#b026ff',
      sourceUrl: '/api/creative/assets/openart_uAY7d1zB.png',
      model: 'flux-3-image',
      cameraMotion: 'Zoom Out',
      speed: 1.0,
    },
  ]);

  // Right Wing Sub-Tab: 'videos' | 'higgsfield' | 'cli' | 'capcut'
  const [rightTab, setRightTab] = useState<'videos' | 'higgsfield' | 'cli' | 'capcut'>('videos');

  // Multi-CLI State
  const [cliCatalog, setCliCatalog] = useState<Record<string, any>>({});
  const [selectedCli, setSelectedCli] = useState<string>('gemini');
  const [cliPrompt, setCliPrompt] = useState<string>(
    'Explain how to optimize a Python FastAPI video pipeline.'
  );
  const [cliOutput, setCliOutput] = useState<string>(
    '[GEMINI PRO SOUL CLI BRIDGE READY]\nSelect any CLI (gemini, claude, grok, codex, higgsfield, temporal) and click EXEC.'
  );
  const [isRunningCli, setIsRunningCli] = useState<boolean>(false);

  const playIntervalRef = useRef<any>(null);

  const loadOmniState = async () => {
    try {
      const res = await fetch('/api/omni/state');
      if (!res.ok) return;
      const data = await res.json();
      if (data.openart?.history) {
        setOpenartHistory(data.openart.history);
        if (data.openart.history.length > 0 && !activeKeyframeUrl) {
          setActiveKeyframeUrl(data.openart.history[0].media_url);
        }
      }
      if (data.higgsfield?.account) setHfAccount(data.higgsfield.account);
      if (data.higgsfield?.models) setHfModels(data.higgsfield.models);
      if (data.higgsfield?.history) {
        setVideoHistory(data.higgsfield.history);
        if (data.higgsfield.history.length > 0 && !renderedVideoUrl) {
          setRenderedVideoUrl(data.higgsfield.history[0].video_url);
        }
      }
      if (data.uploads) setUploadedMedia(data.uploads);
      if (data.capcut?.drafts) setCapcutDrafts(data.capcut.drafts);
      if (data.ai_matrix?.clis) setCliCatalog(data.ai_matrix.clis);
    } catch {
      // Ignore transient load error
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOmniState();
      if (initialFocus === 'openart') {
        setMonitorMode('image');
      } else if (initialFocus === 'video') {
        setMonitorMode('video');
        setRightTab('videos');
      }
    }
  }, [isOpen, initialFocus]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setPlayhead((prev) => (prev >= 30 ? 0 : +(prev + 0.1).toFixed(1)));
      }, 100);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying]);

  if (!isOpen) return null;

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const frames = Math.floor((sec % 1) * 24);
    return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  // File Upload Handler (Images, Videos, Audio)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    sound.playScanTone();
    setStatusBanner(`Uploading '${file.name}' (${(file.size / 1024).toFixed(1)} KB)...`);

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
        const media = data.media;
        setUploadedMedia((prev) => [media, ...prev]);

        if (media.media_type === 'video') {
          setRenderedVideoUrl(media.url);
          setMonitorMode('video');
          const newClip: TimelineClip = {
            id: `up-vid-${Date.now()}`,
            name: `Upload: ${media.original_name}`,
            track: 'video1',
            startTime: playhead,
            duration: 6,
            color: '#00f0ff',
            sourceUrl: media.url,
            model: 'User Upload',
            speed: 1.0,
          };
          setClips((prev) => [...prev, newClip]);
          setSelectedClipId(newClip.id);
          setStatusBanner(`Uploaded video '${media.original_name}' -> Now playing & added to Timeline!`);
        } else if (media.media_type === 'image') {
          setActiveKeyframeUrl(media.url);
          setMonitorMode('image');
          setOpenartHistory((prev) => [
            {
              id: media.id,
              prompt: `Uploaded: ${media.original_name}`,
              model_id: 'user-upload',
              media_url: media.url,
            },
            ...prev,
          ]);
          const newClip: TimelineClip = {
            id: `up-img-${Date.now()}`,
            name: `Img: ${media.original_name}`,
            track: 'video2',
            startTime: playhead,
            duration: 5,
            color: '#b026ff',
            sourceUrl: media.url,
            model: 'User Upload',
            speed: 1.0,
          };
          setClips((prev) => [...prev, newClip]);
          setStatusBanner(
            `Uploaded image '${media.original_name}' -> Ready on Canvas! Click 'Remove BG', 'Upscale 4K', or 'Animate to MP4'.`
          );
        } else {
          const newClip: TimelineClip = {
            id: `up-aud-${Date.now()}`,
            name: `Audio: ${media.original_name}`,
            track: 'audio1',
            startTime: playhead,
            duration: 10,
            color: '#10a37f',
            sourceUrl: media.url,
            speed: 1.0,
          };
          setClips((prev) => [...prev, newClip]);
          setStatusBanner(`Uploaded audio '${media.original_name}' -> Added to Audio Track!`);
        }
        loadOmniState();
      } else {
        setStatusBanner(`Upload error: ${data.error || 'Failed to upload file'}`);
      }
    } catch (err: any) {
      setStatusBanner(`Upload exception: ${err?.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 1-Click Fused 3-Stage Pipeline Execution (Creates Real JPG + Real MP4 + CapCut Sync)
  const handleRunFusedPipeline = async () => {
    if (!masterPrompt.trim()) return;
    setIsFusing(true);
    sound.playScanTone();
    setStatusBanner(
      'FUSING 3 STAGES: Generating Real AI Image -> Animating Playable MP4 Video -> Syncing CapCut Project...'
    );
    try {
      const res = await fetch('/api/omni/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: masterPrompt,
          openart_model: openartModel,
          higgsfield_model: hfModel,
          camera_motion: cameraMotion,
          aspect_ratio: aspectRatio,
          style_preset: openartStyle,
          project_name: projectName,
          duration: 5.0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        if (data.stage1_openart) {
          setOpenartHistory((prev) => [data.stage1_openart, ...prev]);
          setActiveKeyframeUrl(data.stage1_openart.media_url);
        }
        if (data.stage2_higgsfield) {
          setVideoHistory((prev) => [data.stage2_higgsfield, ...prev]);
          setRenderedVideoUrl(data.stage2_higgsfield.video_url);
          setMonitorMode('video');
        }
        if (data.timeline_clip) {
          const newClip: TimelineClip = {
            id: data.timeline_clip.id,
            name: data.timeline_clip.name,
            track: 'video1',
            startTime: playhead,
            duration: data.timeline_clip.duration || 5,
            color: '#00f0ff',
            sourceUrl: data.timeline_clip.sourceUrl,
            model: data.timeline_clip.model,
            cameraMotion: data.timeline_clip.cameraMotion,
            speed: 1.0,
          };
          setClips((prev) => [...prev, newClip]);
          setSelectedClipId(newClip.id);
        }
        setStatusBanner(
          `FUSED PIPELINE COMPLETE // Real Image [${data.stage1_openart?.id}] + Playable MP4 Video [${data.stage2_higgsfield?.id}] now playing!`
        );
        loadOmniState();
      }
    } catch (e: any) {
      setStatusBanner(`Pipeline Alert: ${e?.message || 'Error executing fused pipeline'}`);
    } finally {
      setIsFusing(false);
    }
  };

  // OpenArt Real Image Generation
  const handleOpenArtGenerate = async () => {
    if (!masterPrompt.trim()) return;
    setIsGeneratingImage(true);
    sound.playScanTone();
    setStatusBanner(`Generating real AI image with ${openartModel} (${aspectRatio})...`);
    try {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: masterPrompt,
          model_id: openartModel,
          aspect_ratio: aspectRatio,
          style_preset: openartStyle,
        }),
      });
      const data = await res.json();
      if (data.ok && data.asset) {
        sound.playConfirm();
        setOpenartHistory((prev) => [data.asset, ...prev]);
        setActiveKeyframeUrl(data.asset.media_url);
        setMonitorMode('image');
        setStatusBanner(
          `AI Image [${data.asset.id}] created (${data.asset.width || 1280}x${data.asset.height || 720}). Click 'Animate to MP4' or edit below!`
        );
      }
    } catch (e: any) {
      setStatusBanner(`Image generation error: ${e?.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // OpenArt Real AI Image Editing Tools (Remove BG, Upscale 4K, Magic Inpaint/Enhance)
  const handleImageEditTool = async (tool: 'bg_remover' | 'upscale' | 'inpaint') => {
    const targetImage = activeKeyframeUrl || openartHistory[0]?.media_url;
    if (!targetImage) {
      setStatusBanner('Select or generate an image first to apply AI editing tools.');
      return;
    }
    setIsEditingImage(tool);
    sound.playScanTone();
    const toolLabels: Record<string, string> = {
      bg_remover: 'Removing Background (Alpha Matte Cutout)',
      upscale: 'Upscaling to 4K Ultra-Sharp Detail',
      inpaint: 'Running Magic AI Remix & Enhancement',
    };
    setStatusBanner(`${toolLabels[tool]}...`);
    try {
      const res = await fetch('/api/creative/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: targetImage,
          tool,
          prompt: masterPrompt,
          aspect_ratio: aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.ok && data.asset) {
        sound.playConfirm();
        setOpenartHistory((prev) => [data.asset, ...prev]);
        setActiveKeyframeUrl(data.asset.media_url);
        setMonitorMode('image');
        setStatusBanner(`Tool [${tool.toUpperCase()}] complete! New asset [${data.asset.id}] displayed on canvas.`);
      }
    } catch (e: any) {
      setStatusBanner(`Edit tool error: ${e?.message}`);
    } finally {
      setIsEditingImage(null);
    }
  };

  // Higgsfield Real MP4 Video Generation & Immediate Playback
  const handleHiggsfieldGenerate = async (customSourceImage?: string) => {
    setIsGeneratingVideo(true);
    sound.playScanTone();
    const srcImg = customSourceImage ?? activeKeyframeUrl;
    setStatusBanner(
      `Generating playable MP4 video with [${hfModel}] & Camera [${cameraMotion}]...`
    );
    try {
      const res = await fetch('/api/higgsfield/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: hfModel,
          prompt: masterPrompt,
          aspect_ratio: aspectRatio,
          camera_motion: cameraMotion,
          source_image_url: srcImg || null,
          duration: 5.0,
        }),
      });
      const data = await res.json();
      if (data.ok && data.video_url) {
        const vidRec = data.video || {
          id: data.job_id,
          prompt: masterPrompt,
          model: hfModel,
          camera_motion: cameraMotion,
          video_url: data.video_url,
          duration_sec: 5.0,
        };
        setVideoHistory((prev) => [vidRec, ...prev]);
        setRenderedVideoUrl(data.video_url);
        setMonitorMode('video');

        const newClip: TimelineClip = {
          id: `hf-${Date.now()}`,
          name: `MP4 [${hfModel}]: ${masterPrompt.slice(0, 20)}...`,
          track: 'video1',
          startTime: playhead,
          duration: 5,
          color: '#ff0055',
          sourceUrl: data.video_url,
          model: hfModel,
          cameraMotion,
          speed: 1.0,
        };
        setClips((prev) => [...prev, newClip]);
        setSelectedClipId(newClip.id);
        sound.playConfirm();
        setStatusBanner(
          `MP4 Video [${vidRec.id}] generated and now playing in the Center Monitor!`
        );
      }
    } catch (e: any) {
      setStatusBanner(`Video generation error: ${e?.message}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Render Full Multi-Track NLE Timeline to a Single Playable MP4
  const handleRenderTimelineMp4 = async () => {
    setIsRenderingTimeline(true);
    sound.playScanTone();
    setStatusBanner('Rendering all timeline clips into a single master H.264 MP4 video...');
    try {
      const res = await fetch('/api/video/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips,
          output_name: `${projectName}_${Date.now()}.mp4`,
        }),
      });
      const data = await res.json();
      if ((data.ok || data.status === 'ok') && data.video_url) {
        sound.playConfirm();
        setRenderedVideoUrl(data.video_url);
        setMonitorMode('video');
        if (data.video) {
          setVideoHistory((prev) => [data.video, ...prev]);
        }
        setStatusBanner(`Master Timeline MP4 rendered (${data.size_kb || 200} KB) -> Playing now!`);
      } else {
        setStatusBanner(`Timeline render failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      setStatusBanner(`Render error: ${e?.message}`);
    } finally {
      setIsRenderingTimeline(false);
    }
  };

  // Timeline Controls
  const handleSplitClip = () => {
    const target = clips.find((c) => c.id === selectedClipId);
    if (!target) return;
    const half = +(target.duration / 2).toFixed(1);
    if (half < 0.5) return;
    const firstHalf: TimelineClip = { ...target, duration: half };
    const secondHalf: TimelineClip = {
      ...target,
      id: `${target.id}-split-${Date.now()}`,
      name: `${target.name} (Part B)`,
      startTime: +(target.startTime + half).toFixed(1),
      duration: half,
    };
    setClips((prev) => prev.map((c) => (c.id === target.id ? firstHalf : c)).concat(secondHalf));
    sound.playAcknowledge();
    setStatusBanner(`Split clip '${target.name}' into two segments.`);
  };

  const handleDeleteClip = () => {
    if (clips.length <= 1) {
      setStatusBanner('Cannot delete the last remaining clip on the timeline.');
      return;
    }
    setClips((prev) => {
      const filtered = prev.filter((c) => c.id !== selectedClipId);
      if (filtered.length > 0) setSelectedClipId(filtered[0].id);
      return filtered;
    });
    sound.playScanTone();
    setStatusBanner('Selected clip removed from timeline.');
  };

  const handleExportToCapCut = async () => {
    sound.playScanTone();
    const totalDur = Math.max(...clips.map((c) => c.startTime + c.duration), 15);
    const res = await fetch('/api/capcut/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, duration: totalDur }),
    });
    const data = await res.json();
    if (data.ok) {
      sound.playConfirm();
      setStatusBanner(`Synced project '${projectName}' to CapCut Desktop: ${data.path}`);
      loadOmniState();
    }
  };

  const handleExecuteCli = async () => {
    if (!cliPrompt.trim()) return;
    setIsRunningCli(true);
    sound.playScanTone();
    try {
      const res = await fetch('/api/cli/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli: selectedCli, prompt: cliPrompt }),
      });
      const data = await res.json();
      setCliOutput(
        `>>> [${selectedCli.toUpperCase()} // ${data.mode || 'EXEC'} // ${data.elapsed_sec}s]\nBinary: ${data.binary}\n\n${data.output}`
      );
      sound.playConfirm();
    } catch (e: any) {
      setCliOutput(`CLI Execution Error: ${e?.message}`);
    } finally {
      setIsRunningCli(false);
    }
  };

  const selectedClip = clips.find((c) => c.id === selectedClipId) || clips[0];
  const filteredHfModels = hfModels.filter(
    (m) =>
      !hfSearch ||
      (m.name || m.display_name || '').toLowerCase().includes(hfSearch.toLowerCase()) ||
      (m.id || m.job_type || '').toLowerCase().includes(hfSearch.toLowerCase())
  );

  const currentDownloadUrl =
    monitorMode === 'video' ? renderedVideoUrl : activeKeyframeUrl;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(2, 6, 14, 0.98)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#e0f7ff',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Hidden File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* 1. TOP OMNI-HEADER & 1-CLICK FUSED PIPELINE BAR */}
      <div
        style={{
          padding: '10px 18px',
          background:
            'linear-gradient(90deg, rgba(0,240,255,0.12), rgba(176,38,255,0.15), rgba(255,0,85,0.12))',
          borderBottom: '1px solid rgba(0, 240, 255, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              className="font-tech"
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#00f0ff',
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={17} color="#00f0ff" />
              J.A.R.V.I.S. OMNI-STUDIO // OPENART.AI × HIGGSFIELD × CAPCUT
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid #00f0ff',
                color: '#00f0ff',
              }}
            >
              IMAGES: {openartHistory.length}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(255, 0, 85, 0.15)',
                border: '1px solid #ff0055',
                color: '#ff6699',
              }}
            >
              MP4 VIDEOS: {videoHistory.length}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(16, 163, 127, 0.15)',
                border: '1px solid #10a37f',
                color: '#34d399',
              }}
            >
              CAPCUT DRAFTS: {capcutDrafts.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="font-tech"
              style={{
                background: 'linear-gradient(135deg, #10a37f, #059669)',
                border: '1px solid #34d399',
                color: '#ffffff',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 12px rgba(16, 163, 127, 0.4)',
              }}
            >
              <Upload size={14} />
              {isUploading ? 'UPLOADING...' : 'UPLOAD IMAGE / VIDEO / AUDIO'}
            </button>

            {onPromptToJarvis && (
              <button
                onClick={() => {
                  onPromptToJarvis(masterPrompt);
                  onClose();
                }}
                className="font-mono"
                style={{
                  background: 'rgba(0, 240, 255, 0.12)',
                  border: '1px solid #00f0ff',
                  color: '#00f0ff',
                  padding: '6px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ASK JARVIS IN HUD
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 0, 85, 0.25)',
                border: '1px solid #ff0055',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <X size={14} /> CLOSE STUDIO
            </button>
          </div>
        </div>

        {/* 1-Click Master Prompt & Action Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(4, 12, 26, 0.92)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            flexWrap: 'wrap',
          }}
        >
          <Wand2 size={16} color="#00f0ff" />
          <input
            type="text"
            value={masterPrompt}
            onChange={(e) => setMasterPrompt(e.target.value)}
            placeholder="Describe any image or video you want to create..."
            className="font-mono"
            style={{
              flex: 1,
              minWidth: '240px',
              background: 'rgba(0, 20, 40, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              color: '#ffffff',
              padding: '7px 10px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <select
            value={openartModel}
            onChange={(e) => setOpenartModel(e.target.value)}
            className="font-mono"
            style={{
              background: '#051329',
              border: '1px solid #00f0ff',
              color: '#00f0ff',
              padding: '6px',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          >
            <option value="nano-banana-2-1">Image: Nano Banana 2.1</option>
            <option value="flux-3-image">Image: FLUX 3 Image</option>
            <option value="gpt-image-2-5-flare">Image: GPT Image 2.5</option>
            <option value="byte-plus-seedream-5-pro">Image: Seedream 5 Pro</option>
            <option value="wan2-7-image">Image: Wan 2.7 Image</option>
          </select>
          <select
            value={hfModel}
            onChange={(e) => setHfModel(e.target.value)}
            className="font-mono"
            style={{
              background: '#051329',
              border: '1px solid #b026ff',
              color: '#d896ff',
              padding: '6px',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          >
            <option value="veo3_1">Video: Google Veo 3.1</option>
            <option value="kling4_0">Video: Kling 4.0</option>
            <option value="seedance_2_5">Video: Seedance 2.5</option>
            <option value="wan3_0">Video: Wan 3.0 Video</option>
            <option value="minimax_h3">Video: MiniMax H3</option>
          </select>
          <select
            value={cameraMotion}
            onChange={(e) => setCameraMotion(e.target.value)}
            className="font-mono"
            style={{
              background: '#051329',
              border: '1px solid #ff0055',
              color: '#ff6699',
              padding: '6px',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          >
            <option value="Dolly In">Cam: Dolly In</option>
            <option value="Zoom Out">Cam: Zoom Out</option>
            <option value="Pan Right">Cam: Pan Right</option>
            <option value="Tilt Up">Cam: Tilt Up</option>
          </select>

          <button
            onClick={handleOpenArtGenerate}
            disabled={isGeneratingImage}
            className="font-tech"
            style={{
              background: 'rgba(0, 240, 255, 0.2)',
              border: '1px solid #00f0ff',
              color: '#00f0ff',
              padding: '7px 12px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isGeneratingImage ? 'CREATING IMAGE...' : '🎨 CREATE IMAGE'}
          </button>

          <button
            onClick={() => handleHiggsfieldGenerate()}
            disabled={isGeneratingVideo}
            className="font-tech"
            style={{
              background: 'rgba(255, 0, 85, 0.25)',
              border: '1px solid #ff0055',
              color: '#ffffff',
              padding: '7px 12px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isGeneratingVideo ? 'CREATING MP4...' : '🎬 CREATE VIDEO (MP4)'}
          </button>

          <button
            onClick={handleRunFusedPipeline}
            disabled={isFusing}
            className="font-tech"
            style={{
              background: 'linear-gradient(135deg, #00f0ff, #b026ff, #ff0055)',
              border: 'none',
              color: '#ffffff',
              padding: '7px 14px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)',
            }}
          >
            {isFusing ? 'FUSING ALL 3...' : '⚡ FUSE IMAGE + VIDEO + CAPCUT'}
          </button>
        </div>
      </div>

      {/* 2. MIDDLE 3-COLUMN WORKSPACE */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '330px 1fr 360px', minHeight: 0 }}>
        {/* LEFT WING: OPENART.AI IMAGE FORGE & 1-CLICK AI EDIT TOOLS */}
        <div
          style={{
            borderRight: '1px solid rgba(0, 240, 255, 0.25)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
            background: 'rgba(4, 10, 22, 0.88)',
          }}
        >
          <div
            className="font-tech"
            style={{
              fontSize: '12px',
              color: '#00f0ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
              paddingBottom: '6px',
            }}
          >
            <span>🎨 OPENART IMAGE & EDIT TOOLS</span>
            <span className="font-mono" style={{ fontSize: '10px', color: '#7c9ab8' }}>
              {openartHistory.length} IMAGES
            </span>
          </div>

          {/* Style & Aspect Ratio */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={openartStyle}
              onChange={(e) => setOpenartStyle(e.target.value)}
              className="font-mono"
              style={{
                flex: 1,
                background: '#06152d',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                color: '#e0f7ff',
                padding: '5px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <option value="Cyberpunk">Style: Cyberpunk</option>
              <option value="Photorealistic">Style: Photorealistic 4K</option>
              <option value="Anime Masterpiece">Style: Anime Masterpiece</option>
              <option value="Cinematic 3D">Style: Cinematic 3D</option>
            </select>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="font-mono"
              style={{
                width: '80px',
                background: '#06152d',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                color: '#e0f7ff',
                padding: '5px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </div>

          {/* 1-Click OpenArt AI Editing Tools on Active Image */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '5px',
              background: 'rgba(0, 20, 40, 0.6)',
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid rgba(0, 240, 255, 0.2)',
            }}
          >
            <button
              onClick={() => handleImageEditTool('bg_remover')}
              disabled={!!isEditingImage}
              className="font-mono"
              style={{
                background: 'rgba(0, 240, 255, 0.14)',
                border: '1px solid #00f0ff',
                color: '#00f0ff',
                padding: '6px 4px',
                borderRadius: '4px',
                fontSize: '9px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {isEditingImage === 'bg_remover' ? 'WORKING...' : '✂️ REMOVE BG'}
            </button>
            <button
              onClick={() => handleImageEditTool('upscale')}
              disabled={!!isEditingImage}
              className="font-mono"
              style={{
                background: 'rgba(176, 38, 255, 0.18)',
                border: '1px solid #b026ff',
                color: '#e9d5ff',
                padding: '6px 4px',
                borderRadius: '4px',
                fontSize: '9px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {isEditingImage === 'upscale' ? 'WORKING...' : '🔍 4K UPSCALE'}
            </button>
            <button
              onClick={() => handleImageEditTool('inpaint')}
              disabled={!!isEditingImage}
              className="font-mono"
              style={{
                background: 'rgba(255, 0, 85, 0.18)',
                border: '1px solid #ff0055',
                color: '#ff99bb',
                padding: '6px 4px',
                borderRadius: '4px',
                fontSize: '9px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {isEditingImage === 'inpaint' ? 'WORKING...' : '✨ AI REMIX'}
            </button>
          </div>

          {/* OpenArt Assets Gallery */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {openartHistory.slice(0, 12).map((item) => (
              <div
                key={item.id}
                style={{
                  background:
                    activeKeyframeUrl === item.media_url
                      ? 'rgba(0, 240, 255, 0.16)'
                      : 'rgba(8, 18, 36, 0.85)',
                  border: `1px solid ${
                    activeKeyframeUrl === item.media_url ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)'
                  }`,
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  onClick={() => {
                    setActiveKeyframeUrl(item.media_url);
                    setMonitorMode('image');
                  }}
                  style={{
                    height: '105px',
                    background: '#020710',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={agentMediaUrl(item.media_url)}
                    alt={item.prompt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div className="font-mono" style={{ fontSize: '10px', color: '#bae6fd' }}>
                  {item.prompt?.slice(0, 50)}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {
                      setActiveKeyframeUrl(item.media_url);
                      setMonitorMode('image');
                      sound.playAcknowledge();
                    }}
                    className="font-mono"
                    style={{
                      flex: 1,
                      background: 'rgba(0, 240, 255, 0.18)',
                      border: '1px solid #00f0ff',
                      color: '#00f0ff',
                      fontSize: '9px',
                      padding: '4px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    👁️ VIEW
                  </button>
                  <button
                    onClick={() => {
                      setActiveKeyframeUrl(item.media_url);
                      handleHiggsfieldGenerate(item.media_url);
                    }}
                    className="font-mono"
                    style={{
                      flex: 1,
                      background: 'rgba(255, 0, 85, 0.22)',
                      border: '1px solid #ff0055',
                      color: '#ffffff',
                      fontSize: '9px',
                      padding: '4px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    🎬 ANIMATE MP4
                  </button>
                  <button
                    onClick={() => {
                      const newClip: TimelineClip = {
                        id: `oa-${Date.now()}`,
                        name: `Img: ${item.prompt?.slice(0, 18)}`,
                        track: 'video2',
                        startTime: playhead,
                        duration: 5,
                        color: '#b026ff',
                        sourceUrl: item.media_url,
                        model: item.model_id,
                        speed: 1.0,
                      };
                      setClips((prev) => [...prev, newClip]);
                      sound.playConfirm();
                      setStatusBanner(`Image [${item.id}] added to Timeline Track 2.`);
                    }}
                    className="font-mono"
                    style={{
                      flex: 1,
                      background: 'rgba(176, 38, 255, 0.2)',
                      border: '1px solid #b026ff',
                      color: '#e9d5ff',
                      fontSize: '9px',
                      padding: '4px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    + TIMELINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER MONITOR: REAL HTML5 MP4 VIDEO PLAYER & IMAGE CANVAS */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            gap: '10px',
            background: 'rgba(2, 6, 14, 0.96)',
            minHeight: 0,
          }}
        >
          {/* Mode Switcher Bar above Monitor */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(6, 16, 34, 0.9)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(0, 240, 255, 0.25)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setMonitorMode('video')}
                className="font-tech"
                style={{
                  background:
                    monitorMode === 'video' ? '#ff0055' : 'rgba(255, 0, 85, 0.15)',
                  border: '1px solid #ff0055',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Video size={14} /> VIDEO PLAYER (MP4)
              </button>
              <button
                onClick={() => setMonitorMode('image')}
                className="font-tech"
                style={{
                  background:
                    monitorMode === 'image' ? '#00f0ff' : 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid #00f0ff',
                  color: monitorMode === 'image' ? '#020813' : '#00f0ff',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ImageIcon size={14} /> IMAGE CANVAS (OPENART)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {currentDownloadUrl && (
                <a
                  href={agentMediaUrl(currentDownloadUrl)}
                  download
                  className="font-mono"
                  style={{
                    background: 'rgba(16, 163, 127, 0.25)',
                    border: '1px solid #10a37f',
                    color: '#34d399',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                  }}
                >
                  <Download size={12} /> DOWNLOAD {monitorMode === 'video' ? 'MP4' : 'IMAGE'}
                </a>
              )}
            </div>
          </div>

          {/* Preview Canvas */}
          <div
            style={{
              flex: 1,
              background: 'radial-gradient(circle at center, #081b33 0%, #02060d 100%)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              borderRadius: '8px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              minHeight: '260px',
            }}
          >
            {monitorMode === 'video' && renderedVideoUrl ? (
              <video
                ref={videoPlayerRef}
                key={renderedVideoUrl}
                src={agentMediaUrl(renderedVideoUrl)}
                controls
                autoPlay
                loop
                playsInline
                style={{ width: '100%', height: '100%', maxHeight: '440px', objectFit: 'contain' }}
              />
            ) : activeKeyframeUrl ? (
              <img
                src={agentMediaUrl(activeKeyframeUrl)}
                alt="Active Frame"
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '440px',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div className="font-mono" style={{ color: '#6892b0', fontSize: '12px' }}>
                Select or generate an image or video to preview.
              </div>
            )}

            {/* HUD Overlay Telemetry on Monitor */}
            <div
              className="font-mono"
              style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                background: 'rgba(2, 8, 20, 0.82)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#00f0ff',
                pointerEvents: 'none',
              }}
            >
              MODE: {monitorMode.toUpperCase()} | CLIP: {selectedClip?.name} | CAM:{' '}
              {selectedClip?.cameraMotion || cameraMotion}
            </div>
          </div>

          {/* NLE Transport & CapCut Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(6, 16, 34, 0.92)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '6px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (monitorMode === 'video' && videoPlayerRef.current) {
                    if (videoPlayerRef.current.paused) {
                      videoPlayerRef.current.play();
                      setIsPlaying(true);
                    } else {
                      videoPlayerRef.current.pause();
                      setIsPlaying(false);
                    }
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                style={{
                  background: isPlaying ? '#ff0055' : '#00f0ff',
                  border: 'none',
                  color: '#020813',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                }}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>

              <button
                onClick={handleSplitClip}
                className="font-mono"
                style={{
                  background: 'rgba(0, 240, 255, 0.12)',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  color: '#00f0ff',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                }}
              >
                <Scissors size={12} /> SPLIT CLIP
              </button>

              <button
                onClick={handleDeleteClip}
                className="font-mono"
                style={{
                  background: 'rgba(255, 0, 85, 0.12)',
                  border: '1px solid rgba(255, 0, 85, 0.4)',
                  color: '#ff6699',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                }}
              >
                <Trash2 size={12} /> DELETE CLIP
              </button>

              <button
                onClick={handleRenderTimelineMp4}
                disabled={isRenderingTimeline}
                className="font-tech"
                style={{
                  background: 'linear-gradient(135deg, #ff0055, #b026ff)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <Film size={13} />
                {isRenderingTimeline ? 'RENDERING MP4...' : 'RENDER TIMELINE TO MP4'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="font-mono"
                style={{
                  background: '#030b18',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  color: '#00f0ff',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  width: '150px',
                }}
              />
              <button
                onClick={handleExportToCapCut}
                className="font-tech"
                style={{
                  background: 'rgba(16, 163, 127, 0.25)',
                  border: '1px solid #10a37f',
                  color: '#34d399',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <FolderSync size={13} /> SYNC CAPCUT
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT WING: PLAYABLE MP4 VIDEOS + HIGGSFIELD MODELS + CLIs + CAPCUT */}
        <div
          style={{
            borderLeft: '1px solid rgba(0, 240, 255, 0.25)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            background: 'rgba(4, 10, 22, 0.88)',
          }}
        >
          {/* Sub-Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
            {[
              { id: 'videos', label: `🎬 MP4s (${videoHistory.length})` },
              { id: 'higgsfield', label: '⚡ MODELS' },
              { id: 'cli', label: '💻 CLIs (7)' },
              { id: 'capcut', label: `🎞️ CAPCUT` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id as any)}
                className="font-mono"
                style={{
                  padding: '6px 4px',
                  fontSize: '9px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background:
                    rightTab === t.id ? 'rgba(0, 240, 255, 0.22)' : 'rgba(10, 22, 44, 0.6)',
                  border: `1px solid ${
                    rightTab === t.id ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)'
                  }`,
                  color: rightTab === t.id ? '#00f0ff' : '#8ba4c0',
                  fontWeight: rightTab === t.id ? 700 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: GENERATED & UPLOADED PLAYABLE MP4 VIDEOS */}
          {rightTab === 'videos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              <button
                onClick={() => handleHiggsfieldGenerate()}
                disabled={isGeneratingVideo}
                className="font-tech"
                style={{
                  background: 'linear-gradient(135deg, #ff0055, #b026ff)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isGeneratingVideo
                  ? 'GENERATING PLAYABLE MP4...'
                  : '+ GENERATE NEW MP4 VIDEO FROM PROMPT'}
              </button>

              {videoHistory.map((vid) => {
                const isCurrent = renderedVideoUrl === vid.video_url && monitorMode === 'video';
                return (
                  <div
                    key={vid.id}
                    style={{
                      padding: '8px',
                      background: isCurrent
                        ? 'rgba(255, 0, 85, 0.18)'
                        : 'rgba(8, 18, 36, 0.85)',
                      border: `1px solid ${
                        isCurrent ? '#ff0055' : 'rgba(0, 240, 255, 0.2)'
                      }`,
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="font-tech"
                        style={{ fontSize: '10px', color: '#ff6699', fontWeight: 700 }}
                      >
                        {vid.model?.toUpperCase() || 'MP4 VIDEO'} // {vid.camera_motion || 'MOTION'}
                      </span>
                      <span className="font-mono" style={{ fontSize: '9px', color: '#94a3b8' }}>
                        {vid.size_kb ? `${vid.size_kb} KB` : `${vid.duration_sec || 5}s`}
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#e2e8f0' }}>
                      {vid.prompt?.slice(0, 60)}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setRenderedVideoUrl(vid.video_url);
                          setMonitorMode('video');
                          sound.playConfirm();
                          setStatusBanner(`Playing MP4 video [${vid.id}] in Center Monitor.`);
                        }}
                        className="font-mono"
                        style={{
                          flex: 1,
                          background: '#ff0055',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '9px',
                          padding: '5px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        ▶️ PLAY VIDEO
                      </button>
                      <button
                        onClick={() => {
                          const newClip: TimelineClip = {
                            id: `vid-${Date.now()}`,
                            name: `MP4: ${vid.prompt?.slice(0, 18)}`,
                            track: 'video1',
                            startTime: playhead,
                            duration: vid.duration_sec || 5,
                            color: '#00f0ff',
                            sourceUrl: vid.video_url,
                            model: vid.model,
                            speed: 1.0,
                          };
                          setClips((prev) => [...prev, newClip]);
                          setSelectedClipId(newClip.id);
                          sound.playAcknowledge();
                          setStatusBanner(`Video [${vid.id}] added to CapCut Timeline Track 1.`);
                        }}
                        className="font-mono"
                        style={{
                          flex: 1,
                          background: 'rgba(0, 240, 255, 0.2)',
                          border: '1px solid #00f0ff',
                          color: '#00f0ff',
                          fontSize: '9px',
                          padding: '5px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        + TIMELINE
                      </button>
                      <a
                        href={agentMediaUrl(vid.video_url)}
                        download
                        className="font-mono"
                        style={{
                          background: 'rgba(16, 163, 127, 0.2)',
                          border: '1px solid #10a37f',
                          color: '#34d399',
                          fontSize: '9px',
                          padding: '5px 8px',
                          borderRadius: '3px',
                          textDecoration: 'none',
                        }}
                      >
                        ⬇️
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: 111 HIGGSFIELD MODELS */}
          {rightTab === 'higgsfield' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <input
                type="text"
                value={hfSearch}
                onChange={(e) => setHfSearch(e.target.value)}
                placeholder="Search 111 Higgsfield models (Veo, Kling, Wan, 3D)..."
                className="font-mono"
                style={{
                  background: '#051329',
                  border: '1px solid rgba(176, 38, 255, 0.4)',
                  color: '#ffffff',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              />

              <button
                onClick={() => handleHiggsfieldGenerate()}
                disabled={isGeneratingVideo}
                className="font-tech"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(176,38,255,0.35), rgba(255,0,85,0.35))',
                  border: '1px solid #ff0055',
                  color: '#ffffff',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isGeneratingVideo
                  ? 'GENERATING MP4...'
                  : `🎬 GENERATE [${hfModel.toUpperCase()}] MP4`}
              </button>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                {filteredHfModels.slice(0, 45).map((m) => {
                  const id = m.id || m.job_type;
                  const name = m.name || m.display_name;
                  const active = hfModel === id;
                  return (
                    <div
                      key={id}
                      onClick={() => setHfModel(id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: active
                          ? 'rgba(255, 0, 85, 0.2)'
                          : 'rgba(8, 18, 36, 0.7)',
                        border: `1px solid ${
                          active ? '#ff0055' : 'rgba(176, 38, 255, 0.2)'
                        }`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span className="font-mono" style={{ fontSize: '11px', color: '#f0f9ff' }}>
                        {name}
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '9px',
                          color: '#d896ff',
                          background: 'rgba(176, 38, 255, 0.15)',
                          padding: '2px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {m.type || 'video'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-CLI MATRIX */}
          {rightTab === 'cli' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div className="font-mono" style={{ fontSize: '10px', color: '#00f0ff' }}>
                UNIFIED AI CLI MATRIX (GEMINI, CLAUDE, GROK, CODEX, HIGGSFIELD)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['gemini', 'claude', 'grok', 'codex', 'higgsfield', 'temporal'].map((cid) => {
                  const info = cliCatalog[cid];
                  const active = selectedCli === cid;
                  return (
                    <button
                      key={cid}
                      onClick={() => setSelectedCli(cid)}
                      className="font-mono"
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: active
                          ? 'rgba(0, 240, 255, 0.25)'
                          : 'rgba(8, 20, 40, 0.8)',
                        border: `1px solid ${active ? '#00f0ff' : 'rgba(0, 240, 255, 0.25)'}`,
                        color: active ? '#00f0ff' : '#cbd5e1',
                      }}
                    >
                      {cid.toUpperCase()} {info?.installed ? '●' : '○'}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={cliPrompt}
                  onChange={(e) => setCliPrompt(e.target.value)}
                  className="font-mono"
                  style={{
                    flex: 1,
                    background: '#040d1c',
                    border: '1px solid #00f0ff',
                    color: '#ffffff',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                />
                <button
                  onClick={handleExecuteCli}
                  disabled={isRunningCli}
                  className="font-mono"
                  style={{
                    background: '#00f0ff',
                    border: 'none',
                    color: '#020813',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {isRunningCli ? '...' : 'EXEC'}
                </button>
              </div>

              <pre
                className="font-mono"
                style={{
                  flex: 1,
                  background: '#02060f',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '4px',
                  padding: '8px',
                  fontSize: '10px',
                  color: '#a7f3d0',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {cliOutput}
              </pre>
            </div>
          )}

          {/* TAB 4: CAPCUT DRAFTS */}
          {rightTab === 'capcut' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
              <div className="font-mono" style={{ fontSize: '10px', color: '#10a37f' }}>
                LOCAL CAPCUT DESKTOP PROJECTS (com.lveditor.draft)
              </div>
              {capcutDrafts.map((d) => (
                <div
                  key={d.name}
                  style={{
                    padding: '8px',
                    background: 'rgba(8, 22, 42, 0.8)',
                    border: '1px solid rgba(16, 163, 127, 0.35)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div className="font-mono" style={{ fontSize: '11px', color: '#ecfdf5' }}>
                      {d.name}
                    </div>
                    <div className="font-mono" style={{ fontSize: '9px', color: '#6ee7b7' }}>
                      Tracks: {d.track_count ?? 3} | Res: {d.canvas_width || 1920}x
                      {d.canvas_height || 1080}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setProjectName(d.name);
                      sound.playConfirm();
                      setStatusBanner(`Loaded CapCut Desktop Draft '${d.name}' into NLE Timeline.`);
                    }}
                    className="font-mono"
                    style={{
                      background: 'rgba(16, 163, 127, 0.25)',
                      border: '1px solid #10a37f',
                      color: '#34d399',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      cursor: 'pointer',
                    }}
                  >
                    LOAD DRAFT
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM FULL-WIDTH DOCK: CAPCUT MULTI-TRACK NLE TIMELINE */}
      <div
        style={{
          height: '200px',
          borderTop: '1px solid rgba(0, 240, 255, 0.35)',
          background: 'rgba(3, 8, 18, 0.98)',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {/* Status & Ruler Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="font-mono" style={{ fontSize: '11px', color: '#00f0ff', fontWeight: 600 }}>
            {statusBanner}
          </span>
          <span className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
            TIMECODE {formatTimecode(playhead)} ({playhead}s / 30.0s)
          </span>
        </div>

        {/* Multi-Track NLE Lanes */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = Math.max(0, e.clientX - rect.left - 130);
            const trackWidth = rect.width - 130;
            if (trackWidth > 0) {
              const newSec = +((relX / trackWidth) * 30).toFixed(1);
              setPlayhead(Math.min(30, Math.max(0, newSec)));
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {[
            { id: 'video1', label: 'VIDEO 1 (MP4 CLIPS)' },
            { id: 'video2', label: 'VIDEO 2 (IMAGES)' },
            { id: 'audio1', label: 'AUDIO / UPLOADS' },
          ].map((track) => (
            <div
              key={track.id}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(8, 18, 36, 0.75)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                className="font-mono"
                style={{
                  width: '130px',
                  padding: '0 8px',
                  fontSize: '9px',
                  color: '#93c5fd',
                  borderRight: '1px solid rgba(0, 240, 255, 0.2)',
                  flexShrink: 0,
                }}
              >
                {track.label}
              </div>
              <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                {clips
                  .filter((c) => c.track === track.id)
                  .map((clip) => {
                    const leftPct = (clip.startTime / 30) * 100;
                    const widthPct = (clip.duration / 30) * 100;
                    const isSel = clip.id === selectedClipId;
                    return (
                      <div
                        key={clip.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedClipId(clip.id);
                          if (clip.sourceUrl) {
                            if (clip.sourceUrl.endsWith('.mp4') || clip.sourceUrl.includes('/video/stream/')) {
                              setRenderedVideoUrl(clip.sourceUrl);
                              setMonitorMode('video');
                            } else {
                              setActiveKeyframeUrl(clip.sourceUrl);
                              setMonitorMode('image');
                            }
                          }
                        }}
                        className="font-mono"
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          top: '3px',
                          bottom: '3px',
                          background: `${clip.color}33`,
                          border: `1px solid ${isSel ? '#ffffff' : clip.color}`,
                          borderRadius: '3px',
                          padding: '2px 6px',
                          fontSize: '9px',
                          color: '#ffffff',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {clip.name}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Playhead Vertical Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(130px + ${(playhead / 30) * 100}% * (1 - 130 / 1200))`,
              width: '2px',
              background: '#ff0055',
              boxShadow: '0 0 8px #ff0055',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};
