import { agentMediaUrl } from '../utils/jarvisConfig';
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Cpu,
  Workflow,
  Film,
  Play,
  CheckCircle2,
  XCircle,
  Pause,
  RefreshCw,
  Terminal,
  Monitor,
  Camera,
  Binary,
  Code2,
  Zap,
  Download,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { sound } from '../utils/sound';
import { fold7Hardware, FoldPosture } from '../utils/fold7Hardware';
import {
  GITHUB_CLOUD_CONFIG,
  getGitHubToken,
  setGitHubToken,
  isGitHubCloudForceEnabled,
  setGitHubCloudMode,
} from '../utils/githubCloudEngine';

import { SecPlusDojoPanel, MemoryManagerPanel, AnimePanel, FinancePanel } from './PhaseModulePanels';

export type CommandCenterTab =
  | 'ghidra'
  | 'faceless'
  | 'temporal'
  | 'system'
  | 'diagnostics'
  | 'wendy'
  | 'agent'
  | 'secplus'
  | 'memory'
  | 'anime'
  | 'finance';

interface CommandCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CommandCenterTab;
  onShowMediaOnHud?: (media: { type: 'image' | 'video' | 'audio'; url: string; asset?: any }) => void;
  onPromptToJarvis?: (prompt: string) => void;
}

export const CommandCenterModal: React.FC<CommandCenterModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'ghidra',
  onShowMediaOnHud,
  onPromptToJarvis,
}) => {
  const [activeTab, setActiveTab] = useState<CommandCenterTab>(initialTab);
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 860 : false
  );
  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 860);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [statusMsg, setStatusMsg] = useState<string>(
    'J.A.R.V.I.S. v4.0 TACTICAL COMMAND CENTER // GHIDRA 12.1.4 • FACELESS STUDIO • TEMPORAL GATES • HARDWARE CONTROL'
  );

  // ============================================================================
  // 1. GHIDRA & REVERSE ENGINEERING STATE
  // ============================================================================
  const [ghidraStatus, setGhidraStatus] = useState<any>(null);
  const [selectedBinary, setSelectedBinary] = useState<string>('D:\\Jarvis\\JARVIS.exe');
  const [triageData, setTriageData] = useState<any>(null);
  const [decompileData, setDecompileData] = useState<any>(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isDecompiling, setIsDecompiling] = useState(false);
  const [ghidraSubView, setGhidraSubView] = useState<'triage' | 'decompile' | 'hexdump'>('triage');

  // ============================================================================
  // 2. FACELESS VIDEO AUTOMATION STATE
  // ============================================================================
  const [facelessTopic, setFacelessTopic] = useState<string>(
    'Inside Tony Stark Arc Reactor & J.A.R.V.I.S. Cybernetic Core'
  );
  const [facelessScript, setFacelessScript] = useState<string>('');
  const [facelessStyle, setFacelessStyle] = useState<string>('Cyberpunk');
  const [facelessAspect, setFacelessAspect] = useState<string>('16:9');
  const [facelessScenesCount, setFacelessScenesCount] = useState<number>(2);
  const [isProducingFaceless, setIsProducingFaceless] = useState<boolean>(false);
  const [activeFacelessVideo, setActiveFacelessVideo] = useState<any>(null);
  const [facelessHistory, setFacelessHistory] = useState<any[]>([]);

  // ============================================================================
  // 3. TEMPORAL WORKFLOWS & INTERACTIVE APPROVAL GATES STATE
  // ============================================================================
  const [temporalCluster, setTemporalCluster] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [gatedCmd, setGatedCmd] = useState<string>(
    'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 6 Name, Id, WorkingSet64'
  );
  const [gatedRationale, setGatedRationale] = useState<string>(
    'Audit top memory processes inside durable Temporal workflow'
  );
  const [researchDirective, setResearchDirective] = useState<string>(
    'Reverse-engineering automation with Ghidra 12.1.4 and LLM symbolic execution'
  );
  const [requireResearchApproval, setRequireResearchApproval] = useState<boolean>(true);
  const [isDispatchingWf, setIsDispatchingWf] = useState<boolean>(false);

  // ============================================================================
  // 4. SYSTEM TELEMETRY & DESKTOP CONTROL STATE
  // ============================================================================
  const [sysTelemetry, setSysTelemetry] = useState<any>(null);
  const [sysProcesses, setSysProcesses] = useState<any[]>([]);
  const [sysWindows, setSysWindows] = useState<any[]>([]);
  const [latestScreenshot, setLatestScreenshot] = useState<string>('');
  const [isCapturingScreen, setIsCapturingScreen] = useState<boolean>(false);

  // ============================================================================
  // 5. LIVE SELF-DIAGNOSTICS & GALAXY Z FOLD 7 TELEMETRY MESH STATE
  // ============================================================================
  const [diagResult, setDiagResult] = useState<any>(null);
  const [isRunningDiag, setIsRunningDiag] = useState<boolean>(false);
  const [fold7State, setFold7State] = useState<any>(null);

  // ============================================================================
  // 6. WENDY LABS PHYSICAL AI, ROBOTICS & WENDYOS EDGE HARNESS STATE
  // ============================================================================
  const [wendyState, setWendyState] = useState<any>(null);
  const [selectedWendyTemplate, setSelectedWendyTemplate] = useState<string>('yolov8-object-detection');
  const [selectedWendyDevice, setSelectedWendyDevice] = useState<string>('wendy-jetson-orin-01');
  const [wendyEntitlements, setWendyEntitlements] = useState<string[]>(['gpu', 'camera', 'network.mesh']);
  const [activeWendyDeployment, setActiveWendyDeployment] = useState<any>(null);
  const [isDeployingWendy, setIsDeployingWendy] = useState<boolean>(false);

  // ============================================================================
  // 7. AUTONOMOUS REACT AGENT & GITHUB CLOUD SERVER (dominicano8787/jarvis-omni)
  // ============================================================================
  const [agentState, setAgentState] = useState<any>(null);
  const [agentGoal, setAgentGoal] = useState<string>(
    'Audit J.A.R.V.I.S. GitHub Cloud Server (dominicano8787/jarvis-omni), verify Ghidra binary entropy, and scan WendyOS Physical AI nodes'
  );
  const [activeAgentRun, setActiveAgentRun] = useState<any>(null);
  const [isRunningAgent, setIsRunningAgent] = useState<boolean>(false);
  const [cloudForceMode, setCloudForceMode] = useState<boolean>(() => isGitHubCloudForceEnabled());
  const [githubTokenInput, setGithubTokenInput] = useState<string>(() => getGitHubToken());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Initial & Periodic Loaders
  const loadGhidraStatus = async () => {
    try {
      const res = await fetch('/api/ghidra/status');
      if (res.ok) {
        const data = await res.json();
        setGhidraStatus(data);
        if (data.binaries?.length > 0 && !selectedBinary) {
          setSelectedBinary(data.binaries[0].path);
        }
      }
    } catch {}
  };

  const runBinaryTriage = async (pathOverride?: string) => {
    const target = pathOverride || selectedBinary;
    setIsTriaging(true);
    sound.playScanTone();
    setStatusMsg(`Running static PE/ELF entropy & import table triage on ${target}...`);
    try {
      const res = await fetch('/api/ghidra/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target }),
      });
      const data = await res.json();
      if (data.ok) {
        setTriageData(data);
        setGhidraSubView('triage');
        sound.playConfirm();
        setStatusMsg(`Triage complete: ${data.name} (${data.size_kb} KB) | Entropy: ${data.entropy}/8.0 | ${data.risk_level}`);
      } else {
        setStatusMsg(`Triage error: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMsg(`Triage failed: ${e?.message}`);
    } finally {
      setIsTriaging(false);
    }
  };

  const runDecompile = async (targetOverride?: string) => {
    const target = targetOverride !== undefined ? targetOverride : selectedBinary;
    setIsDecompiling(true);
    sound.playScanTone();
    setStatusMsg(`Decompiling control-flow & pseudo-C via Ghidra 12.1.4 engine...`);
    try {
      const res = await fetch('/api/ghidra/decompile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (data.ok) {
        setDecompileData(data);
        setGhidraSubView('decompile');
        sound.playConfirm();
        setStatusMsg(`Decompilation complete for ${data.binary}`);
      } else {
        setStatusMsg(`Decompile error: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMsg(`Decompile failed: ${e?.message}`);
    } finally {
      setIsDecompiling(false);
    }
  };

  const loadFacelessHistory = async () => {
    try {
      const res = await fetch('/api/faceless/history');
      if (res.ok) {
        const data = await res.json();
        setFacelessHistory(data.videos || []);
        if (data.videos?.length > 0 && !activeFacelessVideo) {
          setActiveFacelessVideo(data.videos[0]);
        }
      }
    } catch {}
  };

  const handleProduceFaceless = async () => {
    if (!facelessTopic.trim()) return;
    setIsProducingFaceless(true);
    sound.playScanTone();
    setStatusMsg(
      `Producing Narrated Faceless Video (${facelessScenesCount} scenes): Synthesizing British Male Voiceover, AI Keyframes & Burned-In Captions...`
    );
    try {
      const res = await fetch('/api/faceless/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: facelessTopic,
          script: facelessScript,
          style_preset: facelessStyle,
          aspect_ratio: facelessAspect,
          num_scenes: facelessScenesCount,
        }),
      });
      const data = await res.json();
      if (data.ok && data.production) {
        sound.playConfirm();
        setActiveFacelessVideo(data.production);
        await loadFacelessHistory();
        setStatusMsg(
          `Faceless Video Complete! ${data.production.duration_sec}s MP4 with British Male Voiceover & CapCut Draft '${data.production.capcut_draft?.draft_name}' ready.`
        );
      } else {
        setStatusMsg(`Faceless pipeline error: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setStatusMsg(`Faceless pipeline failed: ${e?.message}`);
    } finally {
      setIsProducingFaceless(false);
    }
  };

  const loadTemporalState = async () => {
    try {
      const [stRes, wfRes] = await Promise.all([
        fetch('/api/temporal/status'),
        fetch('/api/temporal/workflows'),
      ]);
      if (stRes.ok) setTemporalCluster(await stRes.json());
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(wfData.workflows || []);
      }
    } catch {}
  };

  const handleStartGatedWorkflow = async () => {
    if (!gatedCmd.trim()) return;
    setIsDispatchingWf(true);
    sound.playScanTone();
    setStatusMsg(`Submitting Gated Execution Workflow to Temporal task queue...`);
    try {
      const res = await fetch('/api/temporal/workflow/start-gated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: gatedCmd,
          rationale: gatedRationale,
          danger_level: 'high',
          auto_approve: false,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        setStatusMsg(`Workflow ${data.workflow_id} started and paused at Interactive Approval Gate.`);
        await loadTemporalState();
      }
    } catch (e: any) {
      setStatusMsg(`Failed to start workflow: ${e?.message}`);
    } finally {
      setIsDispatchingWf(false);
    }
  };

  const handleStartResearchWorkflow = async () => {
    if (!researchDirective.trim()) return;
    setIsDispatchingWf(true);
    sound.playScanTone();
    setStatusMsg(`Submitting Durable Research Workflow to Temporal...`);
    try {
      const res = await fetch('/api/temporal/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directive: researchDirective,
          max_passes: 3,
          require_approval: requireResearchApproval,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        setStatusMsg(`Research Workflow ${data.workflow_id} dispatched.`);
        await loadTemporalState();
      }
    } catch (e: any) {
      setStatusMsg(`Failed to start research workflow: ${e?.message}`);
    } finally {
      setIsDispatchingWf(false);
    }
  };

  const handleWorkflowSignal = async (workflowId: string, signal: string) => {
    sound.playScanTone();
    setStatusMsg(`Sending signal '${signal.toUpperCase()}' to workflow ${workflowId}...`);
    try {
      const res = await fetch(`/api/temporal/workflow/${workflowId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal, note: `Operator ${signal} via 3D HUD` }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        setStatusMsg(`Signal '${signal.toUpperCase()}' delivered to ${workflowId}.`);
        setTimeout(loadTemporalState, 600);
      }
    } catch (e: any) {
      setStatusMsg(`Signal error: ${e?.message}`);
    }
  };

  const loadSystemState = async () => {
    try {
      const [telRes, procRes] = await Promise.all([
        fetch('/api/system/telemetry'),
        fetch('/api/system/processes'),
      ]);
      if (telRes.ok) setSysTelemetry(await telRes.json());
      if (procRes.ok) {
        const pData = await procRes.json();
        setSysProcesses(pData.processes || []);
        setSysWindows(pData.windows || []);
      }
    } catch {}
  };

  const handleDesktopAction = async (action: string, target?: any) => {
    if (action === 'capture_screenshot') setIsCapturingScreen(true);
    sound.playScanTone();
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        if (action === 'capture_screenshot' && data.media_url) {
          setLatestScreenshot(data.media_url);
          setStatusMsg(`Live Desktop Screenshot captured (${data.width}x${data.height}).`);
        } else {
          setStatusMsg(data.message || `Executed ${action}`);
          loadSystemState();
        }
      } else {
        setStatusMsg(`Control notice: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMsg(`Action error: ${e?.message}`);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  const loadDiagnosticsAndFold7 = async () => {
    setIsRunningDiag(true);
    try {
      const [diagRes, foldRes] = await Promise.all([
        fetch('/api/diagnostics/run'),
        fetch('/api/mobile/fold7/status'),
      ]);
      if (diagRes.ok) {
        const d = await diagRes.json();
        setDiagResult(d);
      }
      if (foldRes.ok) {
        const f = await foldRes.json();
        setFold7State(f);
      }
    } catch {} finally {
      setIsRunningDiag(false);
    }
  };

  const updateFold7Posture = async (posture: string, hinge_angle: number) => {
    sound.playScanTone();
    const mapped: FoldPosture =
      posture === 'COVER_FOLDED' || posture === 'COVER_DISPLAY'
        ? 'COVER_DISPLAY'
        : posture === 'FLEX_TABLETOP'
        ? 'FLEX_TABLETOP'
        : posture === 'DEX_DESKTOP'
        ? 'DEX_DESKTOP'
        : 'UNFOLDED_MAIN';
    fold7Hardware.setPostureOverride(mapped, hinge_angle);
    try {
      const res = await fetch('/api/mobile/fold7/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posture, hinge_angle }),
      });
      if (res.ok) {
        sound.playConfirm();
        setStatusMsg(`Galaxy Z Fold 7 (SM-F966U) posture synchronized: ${posture} (${hinge_angle}°)`);
        await loadDiagnosticsAndFold7();
      }
    } catch {}
  };

  const loadWendyState = async () => {
    try {
      const res = await fetch('/api/wendy/status');
      if (res.ok) {
        const data = await res.json();
        setWendyState(data);
        if (!activeWendyDeployment && data.deployments?.length > 0) {
          setActiveWendyDeployment(data.deployments[0]);
        }
      }
    } catch {}
  };

  const handleWendyDiscover = async () => {
    sound.playScanTone();
    setStatusMsg('Running `wendy discover --json` across USB-C, mDNS, BLE & Wi-Fi Aware NAN mesh...');
    try {
      const res = await fetch('/api/wendy/discover', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        sound.playConfirm();
        setStatusMsg(`wendy discover complete: ${d.discovered_count} Physical AI & Robotics nodes online.`);
        await loadWendyState();
      }
    } catch {}
  };

  const handleWendyToggleEntitlement = async (entId: string) => {
    sound.playScanTone();
    const next = wendyEntitlements.includes(entId)
      ? wendyEntitlements.filter((x) => x !== entId)
      : [...wendyEntitlements, entId];
    setWendyEntitlements(next);
    try {
      await fetch('/api/wendy/project/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: selectedWendyTemplate, entitlements: next }),
      });
      await loadWendyState();
    } catch {}
  };

  const handleWendyRunDeploy = async () => {
    setIsDeployingWendy(true);
    sound.playScanTone();
    setStatusMsg(`Executing \`wendy run --device ${selectedWendyDevice}\` for ${selectedWendyTemplate}...`);
    try {
      await fetch('/api/wendy/project/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: selectedWendyTemplate,
          template_id: selectedWendyTemplate,
          entitlements: wendyEntitlements,
        }),
      });
      const res = await fetch('/api/wendy/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: selectedWendyTemplate,
          device_id: selectedWendyDevice,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        setActiveWendyDeployment(data.deployment);
        setStatusMsg(`Deployed ${data.deployment.app_id} to ${data.deployment.device_name} via WendyAgentService gRPC.`);
        await loadWendyState();
      }
    } catch (e: any) {
      setStatusMsg(`Wendy deployment error: ${e?.message}`);
    } finally {
      setIsDeployingWendy(false);
    }
  };

  const handleWendyOta = async (deviceId: string, action: string) => {
    sound.playScanTone();
    setStatusMsg(`Triggering wendyos-update (${action}) on ${deviceId}...`);
    try {
      const res = await fetch('/api/wendy/ota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, action }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.playConfirm();
        setStatusMsg(data.message);
        await loadWendyState();
      }
    } catch {}
  };

  const loadAgentState = async () => {
    try {
      const res = await fetch('/api/agent/status');
      if (res.ok) {
        const data = await res.json();
        setAgentState(data);
        if (!activeAgentRun && data.recent_runs?.length > 0) {
          setActiveAgentRun(data.recent_runs[0]);
        }
      }
    } catch {}
  };

  const handleExecuteAgentGoal = async (goalOverride?: string) => {
    const goalToRun = (goalOverride || agentGoal).trim();
    if (!goalToRun) return;
    setIsRunningAgent(true);
    sound.playScanTone();
    setStatusMsg(`Autonomous ReAct Agent executing multi-step plan for: "${goalToRun.slice(0, 70)}..."`);
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalToRun, max_steps: 4 }),
      });
      if (res.ok) {
        const data = await res.json();
        sound.playConfirm();
        setActiveAgentRun(data);
        setStatusMsg(
          `Autonomous ReAct Run ${data.run_id} completed (${data.steps_count} tools executed in ${data.total_duration_ms} ms).`
        );
        await loadAgentState();
      }
    } catch (e: any) {
      setStatusMsg(`Agent execution notice: ${e?.message}`);
    } finally {
      setIsRunningAgent(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadGhidraStatus();
    runBinaryTriage('D:\\Jarvis\\JARVIS.exe');
    runDecompile('decompiled.c');
    loadFacelessHistory();
    loadTemporalState();
    loadSystemState();
    loadDiagnosticsAndFold7();
    loadWendyState();
    loadAgentState();

    const interval = setInterval(() => {
      if (activeTab === 'temporal') loadTemporalState();
      if (activeTab === 'system') loadSystemState();
      if (activeTab === 'diagnostics') loadDiagnosticsAndFold7();
      if (activeTab === 'wendy') loadWendyState();
      if (activeTab === 'agent') loadAgentState();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        backgroundColor: 'rgba(2, 6, 16, 0.94)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#e2f1ff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* TOP HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: isCompact ? 'stretch' : 'center',
          flexDirection: isCompact ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: isCompact ? '8px' : '12px',
          padding: isCompact ? '10px 12px' : '12px 24px',
          background: 'linear-gradient(90deg, rgba(4, 15, 35, 0.98), rgba(16, 8, 40, 0.98))',
          borderBottom: '1px solid rgba(0, 240, 255, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Shield size={18} color="#00f0ff" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div
                className="font-tech"
                style={{
                  fontSize: isCompact ? '12px' : '15px',
                  fontWeight: 900,
                  letterSpacing: isCompact ? '1px' : '2px',
                  color: '#00f0ff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                J.A.R.V.I.S. v4.3 // COMMAND CENTER
              </div>
              {!isCompact && (
                <div className="font-mono" style={{ fontSize: '10px', color: '#7ab0d4' }}>
                  {statusMsg}
                </div>
              )}
            </div>
          </div>

          {isCompact && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '5px 10px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <X size={13} /> CLOSE
            </button>
          )}
        </div>

        {/* NAVIGATION TABS */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexWrap: isCompact ? 'nowrap' : 'wrap',
            overflowX: isCompact ? 'auto' : 'visible',
            paddingBottom: isCompact ? '2px' : '0',
          }}
        >
          {[
            { id: 'agent', label: 'AGENTIC & GITHUB CLOUD', icon: <Terminal size={13} />, color: '#10b981' },
            { id: 'ghidra', label: 'GHIDRA 12.1.4 REA', icon: <Binary size={13} />, color: '#00f0ff' },
            { id: 'faceless', label: 'FACELESS VIDEO', icon: <Film size={13} />, color: '#ff0070' },
            { id: 'temporal', label: 'TEMPORAL GATES', icon: <Workflow size={13} />, color: '#ffb800' },
            { id: 'system', label: 'HARDWARE & DESKTOP', icon: <Cpu size={13} />, color: '#00ff88' },
            { id: 'wendy', label: 'WENDYOS & PHYSICAL AI', icon: <Zap size={13} />, color: '#38bdf8' },
            { id: 'diagnostics', label: 'DIAGNOSTICS & FOLD7', icon: <CheckCircle2 size={13} />, color: '#b026ff' },
            { id: 'secplus', label: 'SECURITY+ DOJO', icon: <Shield size={13} />, color: '#10b981' },
            { id: 'memory', label: 'MEMORY VAULT', icon: <Code2 size={13} />, color: '#b026ff' },
            { id: 'anime', label: 'ANIME DB & STUDIO', icon: <Film size={13} />, color: '#ff0070' },
            { id: 'finance', label: 'FINANCE & RISK', icon: <AlertTriangle size={13} />, color: '#ffb800' },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  sound.playConfirm();
                  setActiveTab(t.id as CommandCenterTab);
                }}
                className="font-tech"
                style={{
                  background: active ? 'rgba(0, 240, 255, 0.2)' : 'rgba(10, 22, 44, 0.7)',
                  border: `1px solid ${active ? t.color : 'rgba(148, 163, 184, 0.25)'}`,
                  color: active ? '#ffffff' : '#94a3b8',
                  padding: '7px 14px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: active ? `0 0 14px ${t.color}55` : 'none',
                }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}

          {!isCompact && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '6px 12px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                marginLeft: '10px',
              }}
            >
              <X size={14} /> CLOSE ESC
            </button>
          )}
        </div>
      </div>

      {/* BODY CONTENT */}
      <div style={{ flex: 1, overflow: isCompact ? 'auto' : 'hidden', display: 'flex', padding: isCompact ? '10px 12px' : '18px 24px', gap: isCompact ? '12px' : '20px' }}>
        {/* ====================================================================
            TAB 1: GHIDRA 12.1.4 & REVERSE ENGINEERING LAB
           ==================================================================== */}
        {activeTab === 'ghidra' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '340px 1fr', gap: isCompact ? '12px' : '20px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Left Sidebar: Binary Selector & Ghidra Telemetry */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', letterSpacing: '1px' }}>
                // GHIDRA 12.1.4 INSTALLATION
              </div>
              <div
                className="font-mono"
                style={{
                  background: 'rgba(0, 30, 60, 0.45)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  borderLeft: '3px solid #00ff88',
                }}
              >
                <div style={{ color: '#00ff88', fontWeight: 700 }}>
                  {ghidraStatus?.ghidra_installed ? '● GHIDRA 12.1.4 PUBLIC ONLINE' : '○ GHIDRA STANDBY'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
                  Root: {ghidraStatus?.ghidra_dir || 'D:\\ghidra\\ghidra_12.1.4_PUBLIC'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                  PyGhidra & GhidraMCP Bridge: READY
                </div>
                <button
                  onClick={async () => {
                    const r = await fetch('/api/ghidra/launch', { method: 'POST' });
                    const d = await r.json();
                    setStatusMsg(d.message || d.error || 'Launched Ghidra');
                  }}
                  className="font-mono"
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    background: 'rgba(0, 240, 255, 0.18)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  🚀 LAUNCH GHIDRA 12.1.4 DESKTOP GUI
                </button>
              </div>

              <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginTop: '4px' }}>
                // TARGET BINARY PATH
              </div>
              <input
                type="text"
                value={selectedBinary}
                onChange={(e) => setSelectedBinary(e.target.value)}
                className="font-mono"
                style={{
                  background: 'rgba(2, 8, 20, 0.9)',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  color: '#e2f1ff',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => runBinaryTriage()}
                  disabled={isTriaging}
                  className="font-tech"
                  style={{
                    flex: 1,
                    background: 'rgba(0, 240, 255, 0.25)',
                    border: '1px solid #00f0ff',
                    color: '#ffffff',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {isTriaging ? 'SCANNING...' : '🔍 STATIC TRIAGE'}
                </button>
                <button
                  onClick={() => runDecompile()}
                  disabled={isDecompiling}
                  className="font-tech"
                  style={{
                    flex: 1,
                    background: 'rgba(176, 38, 255, 0.3)',
                    border: '1px solid #b026ff',
                    color: '#ffffff',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {isDecompiling ? 'DECOMPILING...' : '💻 DECOMPILE C'}
                </button>
              </div>

              <div className="font-tech" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                WORKSPACE BINARIES & ARTIFACTS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                <div
                  onClick={() => runDecompile('decompiled.c')}
                  style={{
                    background: 'rgba(176, 38, 255, 0.15)',
                    border: '1px solid rgba(176, 38, 255, 0.5)',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div className="font-tech" style={{ fontSize: '11px', color: '#e9d5ff' }}>
                    D:\ghidra\work\decompiled.c
                  </div>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#c084fc' }}>
                    PyGhidra Verified Decompilation (checksum + main)
                  </div>
                </div>

                {(ghidraStatus?.binaries || []).map((b: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedBinary(b.path);
                      runBinaryTriage(b.path);
                    }}
                    style={{
                      background:
                        selectedBinary === b.path ? 'rgba(0, 240, 255, 0.18)' : 'rgba(0, 20, 45, 0.45)',
                      border: `1px solid ${
                        selectedBinary === b.path ? '#00f0ff' : 'rgba(0, 240, 255, 0.18)'
                      }`,
                      padding: '7px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="font-tech" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                        {b.name}
                      </span>
                      <span className="font-mono" style={{ fontSize: '10px', color: '#00f0ff' }}>
                        {b.size_kb} KB
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '9px', color: '#6892b0', marginTop: '2px' }}>
                      {b.path}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Main Viewport: Triage / Decompiler / Hex Dump */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'triage', label: 'PE/ELF HEADERS, ENTROPY & IMPORTS' },
                    { id: 'decompile', label: 'GHIDRA DECOMPILED PSEUDO-C' },
                    { id: 'hexdump', label: 'HEX & STRING EXTRACTOR' },
                  ].map((sv) => (
                    <button
                      key={sv.id}
                      onClick={() => setGhidraSubView(sv.id as any)}
                      className="font-mono"
                      style={{
                        background:
                          ghidraSubView === sv.id ? 'rgba(0, 240, 255, 0.25)' : 'rgba(15, 25, 45, 0.7)',
                        border: `1px solid ${ghidraSubView === sv.id ? '#00f0ff' : 'rgba(148,163,184,0.2)'}`,
                        color: ghidraSubView === sv.id ? '#00f0ff' : '#94a3b8',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>

                {triageData && onPromptToJarvis && (
                  <button
                    onClick={() => {
                      onClose();
                      onPromptToJarvis(`Decompile ${triageData.path}`);
                    }}
                    className="font-mono"
                    style={{
                      background: 'rgba(0, 255, 136, 0.18)',
                      border: '1px solid #00ff88',
                      color: '#00ff88',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🧠 SEND BINARY AUDIT TO HUD CHAT
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ghidraSubView === 'triage' && triageData && (
                  <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #00f0ff' }}>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>BINARY / FORMAT</div>
                        <div className="font-tech" style={{ fontSize: '13px', color: '#fff', marginTop: '2px' }}>{triageData.name}</div>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#00f0ff' }}>{triageData.pe?.format || 'Binary'} • {triageData.pe?.machine || 'x64'}</div>
                      </div>
                      <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #ffb800' }}>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>SHANNON ENTROPY</div>
                        <div className="font-tech" style={{ fontSize: '15px', color: '#ffb800', marginTop: '2px' }}>{triageData.entropy} / 8.0</div>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#cbd5e1' }}>{triageData.risk_level}</div>
                      </div>
                      <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #b026ff' }}>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>ENTRY POINT & BASE</div>
                        <div className="font-mono" style={{ fontSize: '12px', color: '#e9d5ff', marginTop: '2px' }}>EP: {triageData.pe?.entry_point_rva || 'N/A'}</div>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#c084fc' }}>Base: {triageData.pe?.image_base || 'N/A'}</div>
                      </div>
                      <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #00ff88' }}>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>SHA-256 DIGEST</div>
                        <div className="font-mono" style={{ fontSize: '10px', color: '#00ff88', marginTop: '4px', wordBreak: 'break-all' }}>
                          {triageData.sha256?.slice(0, 32)}...
                        </div>
                      </div>
                    </div>

                    {/* Section Entropy Bars */}
                    <div style={{ background: 'rgba(2, 10, 24, 0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                      <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginBottom: '8px' }}>
                        PE SECTION TABLE & ENTROPY DISTRIBUTION
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(triageData.pe?.sections || []).map((s: any, idx: number) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 110px 110px 60px 1fr 70px', alignItems: 'center', gap: '10px', fontSize: '11px' }} className="font-mono">
                            <span style={{ color: '#fff', fontWeight: 700 }}>{s.name}</span>
                            <span style={{ color: '#7ab0d4' }}>VA: {s.vaddr}</span>
                            <span style={{ color: '#94a3b8' }}>Raw: {s.rawsize.toLocaleString()} B</span>
                            <span style={{ color: '#00ff88' }}>[{s.permissions}]</span>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, (s.entropy / 8.0) * 100)}%`,
                                  height: '100%',
                                  background: s.entropy > 7.0 ? '#ff0055' : s.entropy > 6.0 ? '#ffb800' : '#00f0ff',
                                }}
                              />
                            </div>
                            <span style={{ color: s.entropy > 7.0 ? '#ff0055' : '#00f0ff', textAlign: 'right' }}>
                              H={s.entropy}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mitigations & Imports */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: 'rgba(2, 10, 24, 0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                        <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginBottom: '8px' }}>
                          SECURITY MITIGATIONS & TRIAGE NOTES
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {Object.entries(triageData.pe?.mitigations || {}).map(([k, v]) => (
                            <span
                              key={k}
                              className="font-mono"
                              style={{
                                fontSize: '10px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: v ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)',
                                border: `1px solid ${v ? '#00ff88' : '#ff3366'}`,
                                color: v ? '#00ff88' : '#ff3366',
                              }}
                            >
                              {v ? '✓' : '✗'} {k}
                            </span>
                          ))}
                        </div>
                        {(triageData.risk_notes || []).map((n: string, idx: number) => (
                          <div key={idx} className="font-mono" style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>
                            • {n}
                          </div>
                        ))}
                      </div>

                      <div style={{ background: 'rgba(2, 10, 24, 0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                        <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginBottom: '8px' }}>
                          IMPORTED DLLS & SYMBOL TABLE
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {(triageData.pe?.imports || []).map((imp: any, idx: number) => (
                            <div key={idx} className="font-mono" style={{ fontSize: '11px' }}>
                              <span style={{ color: '#ffb800', fontWeight: 700 }}>{imp.dll}</span>{' '}
                              <span style={{ color: '#6892b0' }}>({imp.count} symbols):</span>{' '}
                              <span style={{ color: '#cbd5e1' }}>{imp.functions.slice(0, 8).join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {ghidraSubView === 'decompile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {decompileData?.analysis && (
                      <div
                        className="font-mono"
                        style={{
                          background: 'rgba(176, 38, 255, 0.12)',
                          border: '1px solid rgba(176, 38, 255, 0.45)',
                          padding: '12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#e9d5ff',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <div className="font-tech" style={{ color: '#c084fc', marginBottom: '4px' }}>
                          // GHIDRA 12.1.4 CONTROL-FLOW & SYMBOL AUDIT ({decompileData.binary})
                        </div>
                        {decompileData.analysis}
                      </div>
                    )}
                    <pre
                      className="font-mono"
                      style={{
                        background: '#020611',
                        border: '1px solid rgba(0, 240, 255, 0.35)',
                        borderRadius: '6px',
                        padding: '14px',
                        fontSize: '12px',
                        color: '#a5f3fc',
                        overflowX: 'auto',
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {decompileData?.decompiled_c || 'Click "DECOMPILE C" to reconstruct C source from target binary.'}
                    </pre>
                  </div>
                )}

                {ghidraSubView === 'hexdump' && triageData && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginBottom: '6px' }}>
                        ENTRY POINT / HEADER HEX DUMP
                      </div>
                      <pre
                        className="font-mono"
                        style={{
                          background: '#020611',
                          border: '1px solid rgba(0, 240, 255, 0.3)',
                          padding: '12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#38bdf8',
                          overflowX: 'auto',
                        }}
                      >
                        {triageData.pe?.entry_point_hexdump || triageData.header_hexdump}
                      </pre>
                    </div>
                    <div>
                      <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', marginBottom: '6px' }}>
                        EXTRACTED ASCII & UTF-16LE STRINGS ({triageData.strings?.ascii?.length || 0})
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          background: '#020611',
                          border: '1px solid rgba(0, 240, 255, 0.3)',
                          padding: '12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#cbd5e1',
                          maxHeight: '380px',
                          overflowY: 'auto',
                        }}
                      >
                        {(triageData.strings?.ascii || []).map((s: string, i: number) => (
                          <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: FACELESS VIDEO STUDIO (SCRIPT -> VOICEOVER -> B-ROLL -> MP4)
           ==================================================================== */}
        {activeTab === 'faceless' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '380px 1fr', gap: isCompact ? '12px' : '20px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Left Controls */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(255, 0, 112, 0.35)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '13px', color: '#ff0070', letterSpacing: '1px' }}>
                // AUTONOMOUS FACELESS VIDEO PIPELINE
              </div>
              <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                Automatically writes multi-scene narration, synthesizes British Male Neural TTS (`en-GB-RyanNeural`), generates AI B-Roll keyframes, burns lower-third captions, and renders a master MP4 + CapCut draft.
              </div>

              <div>
                <label className="font-mono" style={{ fontSize: '10px', color: '#00f0ff', display: 'block', marginBottom: '4px' }}>
                  VIDEO TOPIC OR TITLE
                </label>
                <input
                  type="text"
                  value={facelessTopic}
                  onChange={(e) => setFacelessTopic(e.target.value)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    background: 'rgba(2, 8, 20, 0.9)',
                    border: '1px solid rgba(0, 240, 255, 0.4)',
                    color: '#fff',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label className="font-mono" style={{ fontSize: '10px', color: '#00f0ff', display: 'block', marginBottom: '4px' }}>
                  OPTIONAL CUSTOM NARRATION SCRIPT (LEAVE BLANK FOR AUTO-SCRIPT)
                </label>
                <textarea
                  rows={3}
                  value={facelessScript}
                  onChange={(e) => setFacelessScript(e.target.value)}
                  placeholder="Optional custom narration sentences..."
                  className="font-mono"
                  style={{
                    width: '100%',
                    background: 'rgba(2, 8, 20, 0.9)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    color: '#e2f1ff',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>STYLE</label>
                  <select
                    value={facelessStyle}
                    onChange={(e) => setFacelessStyle(e.target.value)}
                    className="font-mono"
                    style={{ width: '100%', background: '#040d21', color: '#fff', border: '1px solid #00f0ff', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                  >
                    <option value="Cyberpunk">Cyberpunk</option>
                    <option value="Cinematic 4K">Cinematic 4K</option>
                    <option value="Documentary">Documentary</option>
                    <option value="Anime Masterpiece">Anime 2D</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>ASPECT</label>
                  <select
                    value={facelessAspect}
                    onChange={(e) => setFacelessAspect(e.target.value)}
                    className="font-mono"
                    style={{ width: '100%', background: '#040d21', color: '#fff', border: '1px solid #00f0ff', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Vertical Shorts</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>SCENES</label>
                  <select
                    value={facelessScenesCount}
                    onChange={(e) => setFacelessScenesCount(Number(e.target.value))}
                    className="font-mono"
                    style={{ width: '100%', background: '#040d21', color: '#fff', border: '1px solid #00f0ff', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                  >
                    <option value={2}>2 Scenes (Fast)</option>
                    <option value={3}>3 Scenes (Full)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleProduceFaceless}
                disabled={isProducingFaceless}
                className="font-tech"
                style={{
                  background: 'linear-gradient(135deg, #ff0070, #7000ff)',
                  border: '1px solid #ff0070',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(255, 0, 112, 0.4)',
                }}
              >
                {isProducingFaceless
                  ? '⚙️ PRODUCING VOICEOVER, KEYFRAMES & MP4...'
                  : '🎬 PRODUCE NARRATED FACELESS VIDEO'}
              </button>

              <div className="font-tech" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                PRODUCED FACELESS VIDEOS ({facelessHistory.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                {facelessHistory.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setActiveFacelessVideo(item)}
                    style={{
                      background:
                        activeFacelessVideo?.id === item.id ? 'rgba(255, 0, 112, 0.2)' : 'rgba(0, 20, 45, 0.45)',
                      border: `1px solid ${
                        activeFacelessVideo?.id === item.id ? '#ff0070' : 'rgba(0, 240, 255, 0.2)'
                      }`,
                      padding: '8px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="font-tech" style={{ fontSize: '11px', color: '#fff' }}>
                      {item.topic}
                    </div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#f472b6', marginTop: '2px' }}>
                      {item.scenes_count} Scenes • {item.duration_sec}s • {item.aspect_ratio}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Player & Multi-Scene Storyboard Breakdown */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
              }}
            >
              {activeFacelessVideo ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="font-tech" style={{ fontSize: '14px', color: '#00f0ff' }}>
                        {activeFacelessVideo.topic}
                      </div>
                      <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Voice: {activeFacelessVideo.voice} • Duration: {activeFacelessVideo.duration_sec}s • CapCut Draft: {activeFacelessVideo.capcut_draft?.draft_name || 'Synced'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a
                        href={agentMediaUrl(activeFacelessVideo.video_url)}
                        download
                        className="font-mono"
                        style={{
                          background: 'rgba(16, 163, 127, 0.25)',
                          border: '1px solid #10a37f',
                          color: '#34d399',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          textDecoration: 'none',
                          fontWeight: 700,
                        }}
                      >
                        ⬇ DOWNLOAD MASTER MP4
                      </a>
                      {onShowMediaOnHud && (
                        <button
                          onClick={() => {
                            onShowMediaOnHud({ type: 'video', url: activeFacelessVideo.video_url, asset: activeFacelessVideo });
                            onClose();
                          }}
                          className="font-mono"
                          style={{
                            background: 'rgba(0, 240, 255, 0.2)',
                            border: '1px solid #00f0ff',
                            color: '#00f0ff',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          📺 PIN TO 3D CENTER HUD
                        </button>
                      )}
                    </div>
                  </div>

                  <video
                    key={activeFacelessVideo.video_url}
                    src={agentMediaUrl(activeFacelessVideo.video_url)}
                    controls
                    autoPlay
                    style={{
                      width: '100%',
                      maxHeight: '340px',
                      background: '#000',
                      borderRadius: '6px',
                      border: '1px solid rgba(0, 240, 255, 0.4)',
                    }}
                  />

                  <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff' }}>
                    SCENE-BY-SCENE NARRATION, KEYFRAMES & BURNED CAPTIONS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {(activeFacelessVideo.scenes || []).map((sc: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(2, 10, 24, 0.85)',
                          border: '1px solid rgba(0, 240, 255, 0.25)',
                          borderRadius: '6px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <img
                          src={agentMediaUrl(sc.image_url)}
                          alt={`Scene ${sc.scene_number}`}
                          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <div className="font-tech" style={{ fontSize: '11px', color: '#ff0070' }}>
                          SCENE 0{sc.scene_number} • {sc.camera_motion} ({sc.duration_sec}s)
                        </div>
                        <div className="font-mono" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                          "{sc.narration}"
                        </div>
                        {sc.audio_url && <audio src={agentMediaUrl(sc.audio_url)} controls style={{ width: '100%', height: '28px' }} />}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="font-mono" style={{ color: '#94a3b8', padding: '40px', textAlign: 'center' }}>
                  Enter any topic on the left and click "PRODUCE NARRATED FACELESS VIDEO" to generate a multi-scene narrated MP4 with British Male Voiceover and burned-in captions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: TEMPORAL DURABLE WORKFLOWS & INTERACTIVE APPROVAL GATES
           ==================================================================== */}
        {activeTab === 'temporal' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '380px 1fr', gap: isCompact ? '12px' : '20px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Left Launcher */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(255, 184, 0, 0.35)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '13px', color: '#ffb800' }}>
                // TEMPORAL CLUSTER & APPROVAL GATES
              </div>
              <div
                className="font-mono"
                style={{
                  background: 'rgba(0, 30, 60, 0.45)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  borderLeft: '3px solid #00ff88',
                }}
              >
                <div style={{ color: '#00ff88', fontWeight: 700 }}>
                  ● TEMPORAL SERVER v{temporalCluster?.server_version || '1.27+'} CONNECTED
                </div>
                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
                  Queue: {temporalCluster?.task_queue || 'jarvis-task-queue'} | Namespace: {temporalCluster?.namespace || 'default'}
                </div>
              </div>

              {/* Gated Shell Execution Launcher */}
              <div
                style={{
                  background: 'rgba(255, 184, 0, 0.08)',
                  border: '1px solid rgba(255, 184, 0, 0.35)',
                  padding: '12px',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div className="font-tech" style={{ fontSize: '11px', color: '#ffb800' }}>
                  1. DISPATCH GATED SHELL WORKFLOW (REQUIRES HUD SIGNAL)
                </div>
                <input
                  type="text"
                  value={gatedCmd}
                  onChange={(e) => setGatedCmd(e.target.value)}
                  className="font-mono"
                  style={{ background: '#020814', border: '1px solid rgba(255, 184, 0, 0.4)', color: '#fff', padding: '7px', borderRadius: '4px', fontSize: '11px' }}
                />
                <input
                  type="text"
                  value={gatedRationale}
                  onChange={(e) => setGatedRationale(e.target.value)}
                  placeholder="Rationale shown on approval gate..."
                  className="font-mono"
                  style={{ background: '#020814', border: '1px solid rgba(0, 240, 255, 0.3)', color: '#cbd5e1', padding: '7px', borderRadius: '4px', fontSize: '11px' }}
                />
                <button
                  onClick={handleStartGatedWorkflow}
                  disabled={isDispatchingWf}
                  className="font-tech"
                  style={{
                    background: 'rgba(255, 184, 0, 0.25)',
                    border: '1px solid #ffb800',
                    color: '#fff',
                    padding: '9px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🛡️ START GATED WORKFLOW (WAIT FOR APPROVAL)
                </button>
              </div>

              {/* Durable Research Sweep Launcher */}
              <div
                style={{
                  background: 'rgba(0, 240, 255, 0.08)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div className="font-tech" style={{ fontSize: '11px', color: '#00f0ff' }}>
                  2. DISPATCH MULTI-PASS RESEARCH WORKFLOW
                </div>
                <textarea
                  rows={2}
                  value={researchDirective}
                  onChange={(e) => setResearchDirective(e.target.value)}
                  className="font-mono"
                  style={{ background: '#020814', border: '1px solid rgba(0, 240, 255, 0.4)', color: '#fff', padding: '7px', borderRadius: '4px', fontSize: '11px' }}
                />
                <label className="font-mono" style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={requireResearchApproval}
                    onChange={(e) => setRequireResearchApproval(e.target.checked)}
                  />
                  Hold at Approval Gate before Dossier Synthesis
                </label>
                <button
                  onClick={handleStartResearchWorkflow}
                  disabled={isDispatchingWf}
                  className="font-tech"
                  style={{
                    background: 'rgba(0, 240, 255, 0.25)',
                    border: '1px solid #00f0ff',
                    color: '#fff',
                    padding: '9px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🚀 LAUNCH DURABLE RESEARCH SWEEP
                </button>
              </div>
            </div>

            {/* Right Live Workflows & Approval Gate Cards */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-tech" style={{ fontSize: '13px', color: '#00f0ff' }}>
                  LIVE WORKFLOWS & INTERACTIVE SIGNAL GATES ({workflows.length})
                </div>
                <button
                  onClick={loadTemporalState}
                  className="font-mono"
                  style={{
                    background: 'rgba(0, 240, 255, 0.15)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  ↻ REFRESH TELEMETRY
                </button>
              </div>

              {workflows.map((wf: any, idx: number) => {
                const isWaitingApproval =
                  wf.gate?.gate_state === 'WAITING_APPROVAL' ||
                  wf.progress?.approval_state === 'waiting_approval';
                return (
                  <div
                    key={idx}
                    style={{
                      background: isWaitingApproval ? 'rgba(255, 184, 0, 0.12)' : 'rgba(2, 10, 24, 0.85)',
                      border: `1px solid ${
                        isWaitingApproval
                          ? '#ffb800'
                          : wf.status === 'COMPLETED'
                          ? '#00ff88'
                          : 'rgba(0, 240, 255, 0.3)'
                      }`,
                      borderRadius: '6px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span className="font-tech" style={{ fontSize: '12px', color: '#fff' }}>
                          {wf.title || wf.workflow_id}
                        </span>
                        <span className="font-mono" style={{ fontSize: '10px', color: '#6892b0', marginLeft: '10px' }}>
                          ID: {wf.workflow_id}
                        </span>
                      </div>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: isWaitingApproval
                            ? 'rgba(255, 184, 0, 0.25)'
                            : wf.status === 'COMPLETED'
                            ? 'rgba(0, 255, 136, 0.2)'
                            : 'rgba(0, 240, 255, 0.2)',
                          color: isWaitingApproval
                            ? '#ffb800'
                            : wf.status === 'COMPLETED'
                            ? '#00ff88'
                            : '#00f0ff',
                        }}
                      >
                        {isWaitingApproval ? '⚠ WAITING OPERATOR APPROVAL' : wf.status || 'RUNNING'}
                      </span>
                    </div>

                    <div className="font-mono" style={{ fontSize: '11px', color: '#cbd5e1' }}>
                      Phase: {wf.phase || wf.gate?.gate_state || 'Active'}
                      {wf.rationale && ` — Rationale: ${wf.rationale}`}
                    </div>

                    {/* Interactive Signal Buttons */}
                    {(isWaitingApproval || wf.status === 'RUNNING') && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {isWaitingApproval && (
                          <>
                            <button
                              onClick={() => handleWorkflowSignal(wf.workflow_id, 'approve')}
                              className="font-tech"
                              style={{
                                background: 'rgba(0, 255, 136, 0.25)',
                                border: '1px solid #00ff88',
                                color: '#00ff88',
                                padding: '6px 14px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ✓ APPROVE & EXECUTE SIGNAL
                            </button>
                            <button
                              onClick={() => handleWorkflowSignal(wf.workflow_id, 'deny')}
                              className="font-tech"
                              style={{
                                background: 'rgba(255, 51, 102, 0.25)',
                                border: '1px solid #ff3366',
                                color: '#ff3366',
                                padding: '6px 14px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ✗ DENY & ABORT SIGNAL
                            </button>
                          </>
                        )}
                        {wf.type === 'JarvisResearchWorkflow' && (
                          <>
                            <button
                              onClick={() => handleWorkflowSignal(wf.workflow_id, 'pause')}
                              className="font-mono"
                              style={{
                                background: 'rgba(255, 184, 0, 0.2)',
                                border: '1px solid #ffb800',
                                color: '#ffb800',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                              }}
                            >
                              ⏸ PAUSE
                            </button>
                            <button
                              onClick={() => handleWorkflowSignal(wf.workflow_id, 'resume')}
                              className="font-mono"
                              style={{
                                background: 'rgba(0, 240, 255, 0.2)',
                                border: '1px solid #00f0ff',
                                color: '#00f0ff',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                              }}
                            >
                              ▶ RESUME
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleWorkflowSignal(wf.workflow_id, 'cancel')}
                          className="font-mono"
                          style={{
                            background: 'rgba(148, 163, 184, 0.15)',
                            border: '1px solid #94a3b8',
                            color: '#cbd5e1',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          ⏹ CANCEL WORKFLOW
                        </button>
                      </div>
                    )}

                    {/* Output display if Gated Execution finished */}
                    {wf.gate?.result?.output && (
                      <pre
                        className="font-mono"
                        style={{
                          background: '#020611',
                          border: '1px solid rgba(0, 255, 136, 0.3)',
                          padding: '8px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          color: '#a7f3d0',
                          margin: '4px 0 0 0',
                          maxHeight: '120px',
                          overflowY: 'auto',
                        }}
                      >
                        {wf.gate.result.output}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: SYSTEM TELEMETRY, HARDWARE GRAPHS & DESKTOP CONTROL
           ==================================================================== */}
        {activeTab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '400px 1fr', gap: isCompact ? '12px' : '20px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Left Column: Live CPU/RAM Sparklines, Per-Core Load, & Desktop Launchers */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 255, 136, 0.35)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '13px', color: '#00ff88' }}>
                // PHYSICAL HOST HARDWARE TELEMETRY
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #00f0ff' }}>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>CPU UTILIZATION</div>
                  <div className="font-tech" style={{ fontSize: '20px', color: '#00f0ff' }}>
                    {sysTelemetry?.cpu?.percent ?? 12}%
                  </div>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {sysTelemetry?.cpu?.logical_cores || 16} Threads @ {sysTelemetry?.cpu?.freq_mhz || 3600} MHz
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 30, 60, 0.5)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #00ff88' }}>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#6892b0' }}>SYSTEM MEMORY</div>
                  <div className="font-tech" style={{ fontSize: '20px', color: '#00ff88' }}>
                    {sysTelemetry?.memory?.percent ?? 45}%
                  </div>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {sysTelemetry?.memory?.used_gb} / {sysTelemetry?.memory?.total_gb} GB
                  </div>
                </div>
              </div>

              {/* Per-Core Load Bars */}
              <div style={{ background: 'rgba(2, 10, 24, 0.85)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                <div className="font-mono" style={{ fontSize: '10px', color: '#00f0ff', marginBottom: '6px' }}>
                  PER-THREAD LOGICAL CORE UTILIZATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                  {(sysTelemetry?.cpu?.per_core || []).slice(0, 16).map((pct: number, idx: number) => (
                    <div key={idx} style={{ textAlign: 'center' }}>
                      <div style={{ height: '38px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(6, pct)}%`,
                            background: pct > 80 ? '#ff0055' : pct > 50 ? '#ffb800' : '#00f0ff',
                          }}
                        />
                      </div>
                      <div className="font-mono" style={{ fontSize: '9px', color: '#6892b0', marginTop: '2px' }}>
                        C{idx}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Autonomous Desktop Actions */}
              <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff' }}>
                // AUTONOMOUS DESKTOP SENSOR & APP DISPATCH
              </div>
              <button
                onClick={() => handleDesktopAction('capture_screenshot')}
                disabled={isCapturingScreen}
                className="font-tech"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(0, 255, 136, 0.3))',
                  border: '1px solid #00ff88',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isCapturingScreen ? '📸 CAPTURING DESKTOP...' : '📸 CAPTURE LIVE DESKTOP SCREENSHOT'}
              </button>

              {latestScreenshot && (
                <div style={{ background: '#020611', padding: '8px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                  <img src={latestScreenshot} alt="Desktop Capture" style={{ width: '100%', borderRadius: '4px' }} />
                  {onShowMediaOnHud && (
                    <button
                      onClick={() => {
                        onShowMediaOnHud({ type: 'image', url: latestScreenshot });
                        onClose();
                      }}
                      className="font-mono"
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        background: 'rgba(0, 240, 255, 0.2)',
                        border: '1px solid #00f0ff',
                        color: '#00f0ff',
                        padding: '5px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      DISPLAY SCREENSHOT ON CENTER HUD
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Launch Calculator', app: 'calculator' },
                  { label: 'Launch Notepad', app: 'notepad' },
                  { label: 'Launch Terminal', app: 'terminal' },
                  { label: 'Launch Explorer', app: 'explorer' },
                  { label: 'Launch CapCut', app: 'capcut' },
                  { label: 'Launch Ghidra 12.1', app: 'ghidra' },
                ].map((item) => (
                  <button
                    key={item.app}
                    onClick={() => handleDesktopAction('launch_app', item.app)}
                    className="font-mono"
                    style={{
                      background: 'rgba(0, 30, 60, 0.5)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      color: '#e2f1ff',
                      padding: '7px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Active Windows & Top Processes */}
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '16px', height: '100%', overflow: 'hidden' }}>
              {/* Active Desktop Windows */}
              <div
                style={{
                  background: 'rgba(6, 16, 36, 0.85)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflow: 'hidden',
                }}
              >
                <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff' }}>
                  ACTIVE DESKTOP WINDOWS ({sysWindows.length}) — CLICK TO BRING TO FOREGROUND
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sysWindows.map((w: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(2, 10, 24, 0.75)',
                        padding: '7px 12px',
                        borderRadius: '4px',
                        borderLeft: '2px solid #00f0ff',
                      }}
                    >
                      <div className="font-mono" style={{ fontSize: '11px', color: '#e2f1ff' }}>
                        {w.title}{' '}
                        <span style={{ color: '#6892b0', fontSize: '10px' }}>(PID: {w.pid})</span>
                      </div>
                      <button
                        onClick={() => handleDesktopAction('focus_window', w.hwnd)}
                        className="font-mono"
                        style={{
                          background: 'rgba(0, 240, 255, 0.18)',
                          border: '1px solid #00f0ff',
                          color: '#00f0ff',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        FOCUS WINDOW
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Processes */}
              <div
                style={{
                  background: 'rgba(6, 16, 36, 0.85)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflow: 'hidden',
                }}
              >
                <div className="font-tech" style={{ fontSize: '12px', color: '#00ff88' }}>
                  TOP HOST PROCESSES BY MEMORY & CPU
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {sysProcesses.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 110px 90px 90px',
                        alignItems: 'center',
                        background: 'rgba(2, 10, 24, 0.75)',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}
                      className="font-mono"
                    >
                      <span style={{ color: '#6892b0' }}>#{p.pid}</span>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{p.name}</span>
                      <span style={{ color: '#00ff88' }}>{p.memory_mb} MB</span>
                      <span style={{ color: '#00f0ff' }}>{p.cpu_percent}% CPU</span>
                      {!p.protected ? (
                        <button
                          onClick={() => handleDesktopAction('kill_process', p.pid)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.18)',
                            border: '1px solid #ef4444',
                            color: '#fca5a5',
                            padding: '2px 8px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            cursor: 'pointer',
                          }}
                        >
                          TERMINATE
                        </button>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '9px', textAlign: 'center' }}>PROTECTED</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: LIVE 10-POINT DIAGNOSTICS & GALAXY Z FOLD 7 MESH
           ==================================================================== */}
        {activeTab === 'diagnostics' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.25fr 1fr', gap: isCompact ? '12px' : '20px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Left Column: Live 10-Point System Self-Diagnostic Matrix */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(176, 38, 255, 0.4)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="font-tech" style={{ fontSize: '13px', color: '#00f0ff', letterSpacing: '1px' }}>
                    // LIVE 10-POINT SUBSYSTEM DIAGNOSTIC MATRIX
                  </div>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Score: {diagResult?.score_pct ?? 100}% ({diagResult?.passed ?? 10}/{diagResult?.total ?? 10} ONLINE) • Sweep Latency: {diagResult?.total_latency_ms ?? 0} ms
                  </div>
                </div>
                <button
                  onClick={() => {
                    sound.playScanTone();
                    setStatusMsg('Running 10-point live self-diagnostic sweep across all J.A.R.V.I.S. engines...');
                    loadDiagnosticsAndFold7();
                  }}
                  disabled={isRunningDiag}
                  className="font-tech"
                  style={{
                    background: 'linear-gradient(135deg, #00f0ff, #b026ff)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 14px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} /> {isRunningDiag ? 'PROBING...' : 'RUN SELF-DIAGNOSTIC SWEEP'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {(diagResult?.checks || []).map((chk: any) => (
                  <div
                    key={chk.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(2, 10, 24, 0.8)',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${chk.ok ? '#00ff88' : '#ef4444'}`,
                    }}
                  >
                    <div>
                      <div className="font-tech" style={{ fontSize: '11px', color: '#ffffff' }}>
                        {chk.ok ? '● ' : '✕ '}
                        {chk.name}
                      </div>
                      <div className="font-mono" style={{ fontSize: '10px', color: '#7ab0d4', marginTop: '2px' }}>
                        {chk.detail}
                      </div>
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        background: chk.ok ? 'rgba(0, 255, 136, 0.14)' : 'rgba(239, 68, 68, 0.2)',
                        border: `1px solid ${chk.ok ? '#00ff88' : '#ef4444'}`,
                        color: chk.ok ? '#00ff88' : '#fca5a5',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chk.latency_ms} ms
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Galaxy Z Fold 7 (SM-F966U) Telemetry & Posture Simulator */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '13px', color: '#b026ff', letterSpacing: '1px' }}>
                // SAMSUNG GALAXY Z FOLD 7 (SM-F966U) MESH BRIDGE
              </div>
              <div
                className="font-mono"
                style={{
                  background: 'rgba(0, 30, 60, 0.45)',
                  padding: '12px',
                  borderRadius: '6px',
                  borderLeft: '3px solid #00f0ff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '11px',
                }}
              >
                <div style={{ color: '#00ff88', fontWeight: 700 }}>
                  ● {fold7State?.device?.model || 'Samsung Galaxy Z Fold 7 (SM-F966U)'}
                </div>
                <div style={{ color: '#c4e0f5' }}>SoC: {fold7State?.device?.soc || 'Snapdragon 8 Elite for Galaxy'}</div>
                <div style={{ color: '#c4e0f5' }}>GPU: {fold7State?.device?.gpu || 'Adreno 830 (120Hz LTPO)'}</div>
                <div style={{ color: '#00f0ff' }}>
                  Active Posture: <strong>{fold7State?.device?.posture || 'UNFOLDED_MAIN'}</strong> ({fold7State?.device?.hinge_angle ?? 180}° Hinge)
                </div>
                <div style={{ color: '#94a3b8' }}>
                  Battery: {fold7State?.device?.battery_percent ?? 96}% • Endpoint: {fold7State?.device?.workstation_lan_ip || GITHUB_CLOUD_CONFIG.pagesUrl}
                </div>
              </div>

              <div className="font-tech" style={{ fontSize: '11px', color: '#00f0ff' }}>
                SYNCHRONIZE HINGE POSTURE MODE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: 'UNFOLDED 8.0" (180°)', posture: 'UNFOLDED_MAIN', angle: 180 },
                  { label: 'FLEX MODE (110°)', posture: 'FLEX_TABLETOP', angle: 110 },
                  { label: 'COVER 6.5" (0°)', posture: 'COVER_FOLDED', angle: 0 },
                ].map((mode) => (
                  <button
                    key={mode.posture}
                    onClick={() => updateFold7Posture(mode.posture, mode.angle)}
                    className="font-mono"
                    style={{
                      background:
                        fold7State?.device?.posture === mode.posture
                          ? 'rgba(0, 240, 255, 0.25)'
                          : 'rgba(2, 10, 24, 0.75)',
                      border: `1px solid ${
                        fold7State?.device?.posture === mode.posture ? '#00f0ff' : 'rgba(0, 240, 255, 0.3)'
                      }`,
                      color: '#ffffff',
                      padding: '9px 6px',
                      borderRadius: '5px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {fold7State?.apk_ready && (
                <a
                  href={agentMediaUrl("/api/apk/download")}
                  download
                  className="font-tech"
                  style={{
                    marginTop: 'auto',
                    textAlign: 'center',
                    textDecoration: 'none',
                    background: 'rgba(0, 255, 136, 0.18)',
                    border: '1px solid #00ff88',
                    color: '#00ff88',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  ⬇ DOWNLOAD NATIVE FOLD 7 APK ({Math.round((fold7State.apk_size_bytes || 0) / 1024)} KB)
                </a>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 6: WENDY LABS PHYSICAL AI, ROBOTICS & WENDYOS HARNESS (wendylabsinc)
           ==================================================================== */}
        {activeTab === 'wendy' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.1fr 1.15fr 1fr', gap: isCompact ? '12px' : '16px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Column 1: Discovered WendyOS / wendy-lite Hardware Nodes & Atomic A/B OTA */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="font-tech" style={{ fontSize: '12px', color: '#38bdf8' }}>
                    // WENDY DISCOVER --JSON (EDGE NODES)
                  </div>
                  <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {wendyState?.discovery?.discovered_count ?? 4} Physical AI & Robotics Nodes Online
                  </div>
                </div>
                <button
                  onClick={handleWendyDiscover}
                  className="font-tech"
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '1px solid #38bdf8',
                    color: '#ffffff',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <RefreshCw size={12} /> SCAN MESH
                </button>
              </div>

              {(wendyState?.discovery?.devices || []).map((dev: any) => {
                const selected = selectedWendyDevice === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => setSelectedWendyDevice(dev.id)}
                    style={{
                      background: selected ? 'rgba(56, 189, 248, 0.16)' : 'rgba(2, 10, 24, 0.8)',
                      border: `1px solid ${selected ? '#38bdf8' : 'rgba(56, 189, 248, 0.25)'}`,
                      borderRadius: '6px',
                      padding: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-tech" style={{ fontSize: '11px', color: '#00ff88' }}>
                        ● {dev.name}
                      </span>
                      <span className="font-mono" style={{ fontSize: '9px', color: '#38bdf8' }}>
                        SLOT {dev.ab_active_slot} ACTIVE
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#cbd5e1' }}>
                      {dev.board} • {dev.os_version}
                    </div>
                    <div className="font-mono" style={{ fontSize: '9px', color: '#7ab0d4' }}>
                      Transport: {dev.transport} • Running: <strong>{dev.running_app}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWendyOta(dev.id, 'switch_slot');
                        }}
                        className="font-mono"
                        style={{
                          background: 'rgba(176, 38, 255, 0.2)',
                          border: '1px solid #b026ff',
                          color: '#e9d5ff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          cursor: 'pointer',
                        }}
                      >
                        wendyos-update (Swap Slot {dev.ab_active_slot}↔{dev.ab_standby_slot})
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWendyOta(dev.id, 'rollback');
                        }}
                        className="font-mono"
                        style={{
                          background: 'rgba(255, 184, 0, 0.18)',
                          border: '1px solid #ffb800',
                          color: '#fde68a',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          cursor: 'pointer',
                        }}
                      >
                        Atomic Rollback
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Column 2: wendy.json Manifest, Hardware Entitlements & `wendy run` Deployment */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(0, 255, 136, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#00ff88' }}>
                // WENDY.JSON ENTITLEMENTS & `WENDY RUN` DEPLOYER
              </div>

              <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                1. Select Physical AI App Template (`wendylabsinc/samples`):
              </div>
              <select
                value={selectedWendyTemplate}
                onChange={(e) => {
                  const tplId = e.target.value;
                  setSelectedWendyTemplate(tplId);
                  const found = (wendyState?.sample_templates || []).find((t: any) => t.id === tplId);
                  if (found?.default_entitlements) {
                    setWendyEntitlements(found.default_entitlements);
                  }
                }}
                className="font-mono"
                style={{
                  background: 'rgba(2, 10, 24, 0.9)',
                  border: '1px solid #00f0ff',
                  color: '#ffffff',
                  padding: '8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                }}
              >
                {(wendyState?.sample_templates || []).map((tpl: any) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} [{tpl.platform}]
                  </option>
                ))}
              </select>

              <div className="font-mono" style={{ fontSize: '10px', color: '#94a3b8' }}>
                2. Configure Hardware Sandbox Entitlements (`wendy.json`):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {(wendyState?.entitlements_catalog || []).map((ent: any) => {
                  const active = wendyEntitlements.includes(ent.id);
                  return (
                    <button
                      key={ent.id}
                      onClick={() => handleWendyToggleEntitlement(ent.id)}
                      className="font-mono"
                      title={ent.desc}
                      style={{
                        background: active ? 'rgba(0, 255, 136, 0.22)' : 'rgba(2, 10, 24, 0.7)',
                        border: `1px solid ${active ? '#00ff88' : 'rgba(148, 163, 184, 0.25)'}`,
                        color: active ? '#00ff88' : '#94a3b8',
                        padding: '6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {active ? '✓ ' : '+ '}
                      {ent.id}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleWendyRunDeploy}
                disabled={isDeployingWendy}
                className="font-tech"
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #00ff88)',
                  border: 'none',
                  color: '#020813',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Play size={14} />
                {isDeployingWendy
                  ? 'BUILDING & STREAMING OVER WENDY AGENT GRPC...'
                  : `WENDY RUN -> DEPLOY TO ${selectedWendyDevice.toUpperCase()}`}
              </button>

              <div
                className="font-mono"
                style={{
                  flex: 1,
                  background: 'rgba(2, 8, 18, 0.92)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '10px',
                  color: '#a5f3fc',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {activeWendyDeployment
                  ? activeWendyDeployment.logs?.join('\n')
                  : '// Ready. Click WENDY RUN above to build wendy.json container/WASM and deploy over gRPC.'}
              </div>
            </div>

            {/* Column 3: wendylabsinc GitHub Repository Catalog & service-protos */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.85)',
                border: '1px solid rgba(176, 38, 255, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#b026ff' }}>
                // WENDYLABSINC REPOSITORIES & SERVICE-PROTOS
              </div>
              {(wendyState?.repositories || []).map((repo: any) => (
                <div
                  key={repo.name}
                  style={{
                    background: 'rgba(2, 10, 24, 0.8)',
                    borderLeft: '3px solid #b026ff',
                    padding: '7px 10px',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-tech" style={{ fontSize: '11px', color: '#ffffff' }}>
                      {repo.full_name}
                    </span>
                    <span className="font-mono" style={{ fontSize: '9px', color: '#00f0ff' }}>
                      {repo.category}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                    {repo.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 7: AUTONOMOUS REACT AGENT & GITHUB CLOUD SERVER (dominicano8787) */}
        {/* =================================================================== */}
        {activeTab === 'agent' && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '340px 1fr 340px', gap: isCompact ? '12px' : '16px', width: '100%', height: isCompact ? 'auto' : '100%' }}>
            {/* Column 1: GitHub Cloud Server Topology & Zero-PC Control */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.88)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#10b981', letterSpacing: '1px' }}>
                // GITHUB CLOUD SERVER (NO PC REQUIRED)
              </div>

              <div
                style={{
                  background: 'rgba(2, 12, 28, 0.9)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-tech" style={{ fontSize: '11px', color: '#00ff88' }}>
                    {GITHUB_CLOUD_CONFIG.owner}/{GITHUB_CLOUD_CONFIG.repo}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '9px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      padding: '2px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    24/7 LIVE CLOUD
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '10px', color: '#93c5fd', marginTop: '6px', wordBreak: 'break-all' }}>
                  Pages Server: {GITHUB_CLOUD_CONFIG.pagesUrl}
                </div>
                <div className="font-mono" style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                  PC Required: FALSE (Runs 100% on GitHub Pages + GitHub Models + Actions Cloud)
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <a
                    href={GITHUB_CLOUD_CONFIG.pagesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-tech"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#ffffff',
                      fontSize: '10px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    OPEN GITHUB LIVE SERVER
                  </a>
                  <a
                    href={GITHUB_CLOUD_CONFIG.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-tech"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px',
                      background: 'rgba(0, 240, 255, 0.15)',
                      border: '1px solid #00f0ff',
                      color: '#00f0ff',
                      fontSize: '10px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    GITHUB REPO
                  </a>
                </div>
              </div>

              {/* Execution Routing Toggle */}
              <div
                style={{
                  background: 'rgba(2, 10, 24, 0.85)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <div className="font-tech" style={{ fontSize: '10px', color: '#00f0ff', marginBottom: '6px' }}>
                  SERVER ROUTING MODE (.EXE & .APK)
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => {
                      sound.playConfirm();
                      setCloudForceMode(true);
                      setGitHubCloudMode('github_cloud');
                      setStatusMsg('Switched to Direct GitHub Cloud Server Mode (0% PC Dependency).');
                    }}
                    className="font-tech"
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '10px',
                      background: cloudForceMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(15, 23, 42, 0.8)',
                      border: `1px solid ${cloudForceMode ? '#10b981' : '#334155'}`,
                      color: '#ffffff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    GITHUB CLOUD ONLY
                  </button>
                  <button
                    onClick={() => {
                      sound.playConfirm();
                      setCloudForceMode(false);
                      setGitHubCloudMode('hybrid_auto');
                      setStatusMsg('Switched to Hybrid Auto-Failover Mode (Local PC + Automatic GitHub Cloud when PC is OFF).');
                    }}
                    className="font-tech"
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '10px',
                      background: !cloudForceMode ? 'rgba(0, 240, 255, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                      border: `1px solid ${!cloudForceMode ? '#00f0ff' : '#334155'}`,
                      color: '#ffffff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    HYBRID AUTO-CLOUD
                  </button>
                </div>
              </div>

              {/* Optional GitHub Models PAT */}
              <div
                style={{
                  background: 'rgba(2, 10, 24, 0.85)',
                  border: '1px solid rgba(176, 38, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <div className="font-tech" style={{ fontSize: '10px', color: '#b026ff', marginBottom: '4px' }}>
                  GITHUB MODELS API TOKEN (OPTIONAL)
                </div>
                <div className="font-mono" style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
                  Zero-key Cloud AI is enabled by default. Add a GitHub PAT (`models:read`) to route directly via `models.github.ai`:
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="ghp_... or github_pat_..."
                    className="font-mono"
                    style={{
                      flex: 1,
                      background: 'rgba(4, 12, 28, 0.95)',
                      border: '1px solid rgba(176, 38, 255, 0.4)',
                      color: '#e2f1ff',
                      padding: '5px 8px',
                      fontSize: '10px',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    onClick={() => {
                      sound.playConfirm();
                      setGitHubToken(githubTokenInput);
                      setStatusMsg('Saved GitHub Models API token to Cloud Storage.');
                    }}
                    className="font-tech"
                    style={{
                      padding: '5px 10px',
                      background: 'rgba(176, 38, 255, 0.25)',
                      border: '1px solid #b026ff',
                      color: '#ffffff',
                      fontSize: '10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    SAVE
                  </button>
                </div>
              </div>

              {/* Autonomous Tool Registry */}
              <div className="font-tech" style={{ fontSize: '11px', color: '#00f0ff', marginTop: '4px' }}>
                // AUTONOMOUS REACT AGENT TOOLS ({agentState?.tools?.length || 7})
              </div>
              {(agentState?.tools || []).map((tool: any) => (
                <div
                  key={tool.id}
                  style={{
                    background: 'rgba(2, 10, 24, 0.8)',
                    borderLeft: '3px solid #10b981',
                    padding: '6px 9px',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="font-tech" style={{ fontSize: '10px', color: '#ffffff' }}>
                      {tool.id}
                    </span>
                    <span className="font-mono" style={{ fontSize: '8px', color: '#10b981' }}>
                      {tool.category}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                    {tool.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Column 2: Autonomous Multi-Step ReAct Goal Dispatcher & Live Trace */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.88)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#00f0ff', letterSpacing: '1px' }}>
                // AUTONOMOUS MULTI-STEP REACT AGENT EXECUTOR (PLAN → THINK → ACT → OBSERVE → SYNTHESIZE)
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={agentGoal}
                  onChange={(e) => setAgentGoal(e.target.value)}
                  placeholder="Enter autonomous multi-step objective..."
                  className="font-mono"
                  style={{
                    flex: 1,
                    background: 'rgba(2, 8, 20, 0.95)',
                    border: '1px solid rgba(0, 240, 255, 0.45)',
                    color: '#ffffff',
                    padding: '8px 12px',
                    fontSize: '11px',
                    borderRadius: '5px',
                  }}
                />
                <button
                  onClick={() => handleExecuteAgentGoal()}
                  disabled={isRunningAgent}
                  className="font-tech"
                  style={{
                    padding: '8px 16px',
                    background: isRunningAgent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.3)',
                    border: '1px solid #10b981',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  {isRunningAgent ? 'EXECUTING AGENT...' : 'LAUNCH AUTONOMOUS AGENT'}
                </button>
              </div>

              {/* Preset Mission Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  'Audit GitHub Cloud Server (dominicano8787/jarvis-omni) & verify 24/7 serverless readiness',
                  'Run Ghidra 12.1.4 binary entropy triage on JARVIS.exe and verify PE sections',
                  'Scan WendyOS Physical AI fleet and stage YOLOv8 container deployment',
                  'Synthesize a 4K Stark Arc Reactor blueprint and verify system telemetry',
                ].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAgentGoal(preset);
                      handleExecuteAgentGoal(preset);
                    }}
                    className="font-mono"
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      color: '#bae6fd',
                      fontSize: '9px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Mission #{i + 1}: {preset.slice(0, 44)}...
                  </button>
                ))}
              </div>

              {/* Active ReAct Step Trace */}
              <div
                style={{
                  flex: 1,
                  background: 'rgba(2, 8, 18, 0.92)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '6px',
                  padding: '12px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {activeAgentRun ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,240,255,0.2)', paddingBottom: '6px' }}>
                      <span className="font-tech" style={{ fontSize: '11px', color: '#10b981' }}>
                        RUN ID: {activeAgentRun.run_id} // {activeAgentRun.status} ({activeAgentRun.total_duration_ms} ms)
                      </span>
                      <span className="font-mono" style={{ fontSize: '10px', color: '#00f0ff' }}>
                        Engine: {activeAgentRun.engine}
                      </span>
                    </div>

                    {(activeAgentRun.steps || []).map((st: any) => (
                      <div
                        key={st.step}
                        style={{
                          background: 'rgba(8, 22, 46, 0.85)',
                          borderLeft: '3px solid #00f0ff',
                          padding: '8px 10px',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="font-tech" style={{ fontSize: '10px', color: '#00f0ff' }}>
                            STEP {st.step} // TOOL: {st.tool}
                          </span>
                          <span className="font-mono" style={{ fontSize: '9px', color: '#10b981' }}>
                            {st.status} ({st.duration_ms} ms)
                          </span>
                        </div>
                        <div className="font-mono" style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '3px' }}>
                          <strong>Thought:</strong> {st.thought}
                        </div>
                        <div className="font-mono" style={{ fontSize: '9px', color: '#a5f3fc', marginTop: '3px' }}>
                          <strong>Observation:</strong> {st.observation}
                        </div>
                      </div>
                    ))}

                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '10px',
                        borderRadius: '6px',
                      }}
                    >
                      <div className="font-tech" style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>
                        // EXECUTIVE AGENT SYNTHESIS
                      </div>
                      <div className="font-mono" style={{ fontSize: '10px', color: '#e2f1ff', whiteSpace: 'pre-wrap' }}>
                        {activeAgentRun.final_synthesis}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="font-mono" style={{ fontSize: '11px', color: '#64748b' }}>
                    // Click LAUNCH AUTONOMOUS AGENT above to execute a multi-step ReAct mission across GitHub Cloud, Ghidra 12.1.4, WendyOS Physical AI, and Creative 4K Studio.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Recent Autonomous Agent Runs & GitHub Actions Workflows */}
            <div
              style={{
                background: 'rgba(6, 16, 36, 0.88)',
                border: '1px solid rgba(176, 38, 255, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
              }}
            >
              <div className="font-tech" style={{ fontSize: '12px', color: '#b026ff' }}>
                // GITHUB ACTIONS CLOUD WORKFLOWS & AGENT LEDGER
              </div>

              {(agentState?.github_cloud?.workflows || [
                { name: 'J.A.R.V.I.S. 24/7 GitHub Pages Cloud Server Deploy', file: '.github/workflows/jarvis-pages-deploy.yml', status: 'active' },
                { name: 'J.A.R.V.I.S. Autonomous Agent Cloud Worker', file: '.github/workflows/jarvis-agent-server.yml', status: 'active' },
              ]).map((wf: any, i: number) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(2, 10, 24, 0.85)',
                    borderLeft: '3px solid #b026ff',
                    padding: '8px 10px',
                    borderRadius: '4px',
                  }}
                >
                  <div className="font-tech" style={{ fontSize: '10px', color: '#ffffff' }}>
                    {wf.name}
                  </div>
                  <div className="font-mono" style={{ fontSize: '9px', color: '#00f0ff', marginTop: '2px' }}>
                    {wf.file} • {wf.status?.toUpperCase()}
                  </div>
                </div>
              ))}

              <div className="font-tech" style={{ fontSize: '11px', color: '#00f0ff', marginTop: '6px' }}>
                // RECENT AUTONOMOUS RUNS ({agentState?.recent_runs?.length || 0})
              </div>
              {(agentState?.recent_runs || []).map((r: any) => (
                <div
                  key={r.run_id}
                  onClick={() => setActiveAgentRun(r)}
                  style={{
                    background: activeAgentRun?.run_id === r.run_id ? 'rgba(0, 240, 255, 0.16)' : 'rgba(2, 10, 24, 0.8)',
                    border: '1px solid rgba(0, 240, 255, 0.25)',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="font-tech" style={{ fontSize: '10px', color: '#10b981' }}>
                      {r.run_id}
                    </span>
                    <span className="font-mono" style={{ fontSize: '9px', color: '#94a3b8' }}>
                      {r.steps_count} steps • {r.total_duration_ms}ms
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '9px', color: '#e2f1ff', marginTop: '3px' }}>
                    {r.goal?.slice(0, 75)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            PHASE 1-3 MODULE TABS (components in PhaseModulePanels.tsx)
           ==================================================================== */}
        {activeTab === 'secplus' && <SecPlusDojoPanel />}
        {activeTab === 'memory' && <MemoryManagerPanel />}
        {activeTab === 'anime' && <AnimePanel onShowMediaOnHud={onShowMediaOnHud} />}
        {activeTab === 'finance' && <FinancePanel />}
      </div>
    </div>
  );
};
