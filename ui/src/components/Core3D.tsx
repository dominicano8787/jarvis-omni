import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Core3DProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
}

export const Core3D: React.FC<Core3DProps> = ({ status }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 46;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // 3. Central Arc Core Sphere (Geometry + Wireframe)
    const coreGeo = new THREE.IcosahedronGeometry(7.2, 3);
    const coreMat = new THREE.MeshBasicMaterial({
      color: status === 'listening' ? 0xff3366 : 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Inner Glowing Core
    const innerGeo = new THREE.SphereGeometry(4.8, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: status === 'listening' ? 0xff0044 : 0x0088ff,
      transparent: true,
      opacity: 0.85,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerCore);

    // 4. Concentric Holographic Arc Rings
    const createRing = (
      radius: number,
      tube: number,
      radialSegments: number,
      tubularSegments: number,
      color: number
    ) => {
      const ringGeo = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      });
      return new THREE.Mesh(ringGeo, ringMat);
    };

    const ring1 = createRing(13.5, 0.14, 16, 90, 0x00f0ff);
    const ring2 = createRing(17.8, 0.1, 16, 100, 0x0077ff);
    const ring3 = createRing(22.2, 0.16, 8, 120, 0x00e5ff);

    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring3.rotation.x = -Math.PI / 6;

    scene.add(ring1);
    scene.add(ring2);
    scene.add(ring3);

    // 5. 3D Neural Second Brain Galaxy (750 Heterogeneous Clustered Star Nodes)
    const particleCount = 750;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Palette: Cyan (Canon), Gold (Tasks), Green (Architecture), Purple (Lore)
    const colorPalette = [
      new THREE.Color(0x00f0ff), // Cyan (Canon)
      new THREE.Color(0xffb800), // Gold (Tasks)
      new THREE.Color(0x00ff88), // Green (Architecture)
      new THREE.Color(0xb026ff), // Violet (Lore/Story)
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const clusterIdx = i % colorPalette.length;
      const assignedColor = colorPalette[clusterIdx];

      // Galactic spiral arm distribution
      const radius = 20 + Math.random() * 28;
      const angle = (i / particleCount) * Math.PI * 8 + (Math.random() - 0.5) * 1.5;
      const spreadY = (Math.random() - 0.5) * 16;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = spreadY + Math.sin(radius * 0.2) * 3;
      positions[i3 + 2] = Math.sin(angle) * radius;

      colors[i3] = assignedColor.r;
      colors[i3 + 1] = assignedColor.g;
      colors[i3 + 2] = assignedColor.b;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particlesMat = new THREE.PointsMaterial({
      size: 0.75,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleGalaxy = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleGalaxy);

    // 6. Neural Web Connecting Lines (Synthesizing Neural Synapses)
    const lineIndices: number[] = [];
    const linePositions: number[] = [];
    const maxConnectionsPerNode = 2;
    const maxDistance = 6.5;

    for (let i = 0; i < Math.min(particleCount, 220); i++) {
      let connections = 0;
      const x1 = positions[i * 3];
      const y1 = positions[i * 3 + 1];
      const z1 = positions[i * 3 + 2];

      for (let j = i + 1; j < Math.min(particleCount, 220); j++) {
        if (connections >= maxConnectionsPerNode) break;
        const x2 = positions[j * 3];
        const y2 = positions[j * 3 + 1];
        const z2 = positions[j * 3 + 2];

        const distSq = (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2;
        if (distSq < maxDistance ** 2) {
          linePositions.push(x1, y1, z1, x2, y2, z2);
          connections++;
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const neuralLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(neuralLines);

    // 7. Interactive Mouse Tracking
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Resize handler
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 8. Animation Loop
    const clock = new THREE.Clock();
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Dynamic status-based pulse rate & scale
      const pulseSpeed =
        status === 'processing' ? 6.5 : status === 'speaking' ? 4.2 : status === 'listening' ? 3.0 : 1.6;
      const pulseAmp = status === 'processing' ? 0.14 : status === 'speaking' ? 0.11 : 0.06;
      const scale = 1 + Math.sin(elapsedTime * pulseSpeed) * pulseAmp;
      core.scale.set(scale, scale, scale);
      innerCore.scale.set(scale * 0.95, scale * 0.95, scale * 0.95);

      // Core rotation
      const rotSpeed = status === 'processing' ? 0.025 : 0.006;
      core.rotation.x += rotSpeed;
      core.rotation.y += rotSpeed * 1.4;

      // Holographic Ring rotations
      const ringMultiplier = status === 'processing' ? 3.8 : 1.0;
      ring1.rotation.z += 0.01 * ringMultiplier;
      ring1.rotation.y += 0.006 * ringMultiplier;

      ring2.rotation.x -= 0.008 * ringMultiplier;
      ring2.rotation.z -= 0.012 * ringMultiplier;

      ring3.rotation.y += 0.007 * ringMultiplier;
      ring3.rotation.x += 0.009 * ringMultiplier;

      // Galaxy & Synaptic rotation
      particleGalaxy.rotation.y = elapsedTime * 0.035;
      particleGalaxy.rotation.x = elapsedTime * 0.012;
      neuralLines.rotation.y = elapsedTime * 0.035;
      neuralLines.rotation.x = elapsedTime * 0.012;

      // Smooth mouse-follow parallax
      camera.position.x += (mouseX * 6 - camera.position.x) * 0.04;
      camera.position.y += (mouseY * 6 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [status]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
};
