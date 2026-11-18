import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  Bot,
  BookOpen,
  Coffee,
  Globe,
  Hourglass,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';

const SERVER_HTTP = 'http://localhost:3001';
const SERVER_WS = 'ws://localhost:3001';

// Staircase waypoints connecting Floor 1 (y = 0) and Floor 2 (y = 3.4)
const STAIR_BOTTOM = [6.6, 0, 3.35];
const STAIR_MID = [6.6, 1.7, 0.65];
const STAIR_TOP = [6.6, 3.4, -2.05];

// Exact seats & stations mapped to furniture positions: [x, y, z, rotY, pose]
const ZONE_SEATS = {
  Entering: [[-6.0, 0, 5.2, 0.4, 'stand']],
  Leaving: [[-6.2, 0, 5.7, 3.14, 'stand']],
  Write: [
    [-4.1, 0, -1.45, Math.PI, 'sit_desk'],
    [-2.7, 0, -1.45, Math.PI, 'sit_desk'],
    [2.7, 0, -1.45, Math.PI, 'sit_desk'],
    [4.1, 0, -1.45, Math.PI, 'sit_desk'],
  ],
  Read: [
    [-3.0, 3.4, -2.15, Math.PI, 'sit_desk'],
    [-1.4, 3.4, -2.15, Math.PI, 'sit_desk'],
    [2.1, 3.4, -3.15, 0, 'sit_desk'],
    [3.6, 3.4, -3.15, 0, 'sit_desk'],
  ],
  Browser: [
    [-1.4, 0, 0.85, Math.PI * 0.4, 'stand_globe'],
    [1.8, 0, 0.85, -Math.PI * 0.4, 'stand_globe'],
    [0.2, 0, 2.2, Math.PI, 'stand_globe'],
  ],
  Waiting: [
    [-4.8, 0, 2.65, 0, 'sit_desk'],
    [-3.5, 0, 2.65, 0, 'sit_desk'],
  ],
  Idle: [
    [2.5, 0, 4.7, 2.4, 'sit_sofa'],
    [3.4, 0, 4.95, Math.PI, 'sit_sofa'],
    [4.3, 0, 4.65, -2.4, 'sit_sofa'],
    [1.6, 0, 4.35, 1.2, 'sit_sofa'],
  ],
};

const STATUS_META = {
  Entering: {
    label: 'Vào Ca',
    dept: 'Tầng 1 • Cổng Check-in',
    color: '#0284c7',
    neon: '#38bdf8',
    bg: '#e0f2fe',
    icon: LogIn,
  },
  Leaving: {
    label: 'Tan Ca',
    dept: 'Tầng 1 • Lối Ra',
    color: '#475569',
    neon: '#94a3b8',
    bg: '#f1f5f9',
    icon: LogOut,
  },
  Read: {
    label: 'Đọc & Họp',
    dept: 'Tầng 2 • Meeting Room & Tài Liệu',
    color: '#d97706',
    neon: '#fbbf24',
    bg: '#fef3c7',
    icon: BookOpen,
  },
  Write: {
    label: 'Lập Trình',
    dept: 'Tầng 1 • Khu Tự Động Hóa',
    color: '#16a34a',
    neon: '#4ade80',
    bg: '#dcfce7',
    icon: Pencil,
  },
  Browser: {
    label: 'Tra Cứu Web',
    dept: 'Tầng 1 • Đài Quả Địa Cầu AI',
    color: '#2563eb',
    neon: '#38bdf8',
    bg: '#dbeafe',
    icon: Globe,
  },
  Waiting: {
    label: 'Chờ Ý Kiến',
    dept: 'Tầng 1 • Bàn Điều Phối',
    color: '#e11d48',
    neon: '#fb7185',
    bg: '#ffe4e6',
    icon: Hourglass,
  },
  Idle: {
    label: 'Uống Trà',
    dept: 'Tầng 1 • Sofa Thưởng Trà',
    color: '#0d9488',
    neon: '#2dd4bf',
    bg: '#ccfbf1',
    icon: Coffee,
  },
};

const AMBIENT_INITIAL = [
  {
    agentId: 'ambient-coder',
    agentName: 'Bé Mochi (Dev)',
    status: 'Write',
    department: STATUS_META.Write.dept,
    reportText: 'Đang ngồi ghế Tầng 1 gõ code module mới cho hệ thống AI! 💻',
    progress: 72,
    stageLabel: 'Tầng 1 • Đang lập trình',
    color: '#38bdf8',
    hairColor: '#1e293b',
    hairStyle: 'buns',
    isAmbient: true,
  },
  {
    agentId: 'ambient-reader',
    agentName: 'Bé Yuzu (Research)',
    status: 'Read',
    department: STATUS_META.Read.dept,
    reportText: 'Đang ngồi ở Meeting Room Tầng 2 phân tích tài liệu kiến trúc 📚',
    progress: 64,
    stageLabel: 'Tầng 2 • Đọc tài liệu',
    color: '#fbbf24',
    hairColor: '#7c2d12',
    hairStyle: 'ponytail',
    isAmbient: true,
  },
  {
    agentId: 'ambient-browser',
    agentName: 'Bé Sora (Web AI)',
    status: 'Browser',
    department: STATUS_META.Browser.dept,
    reportText: 'Đang đứng cạnh Quả Địa Cầu Hologram tra cứu dữ liệu mới nhất 🌐',
    progress: 80,
    stageLabel: 'Trung Tâm • Tra cứu Web',
    color: '#a78bfa',
    hairColor: '#4c1d95',
    hairStyle: 'bob',
    isAmbient: true,
  },
  {
    agentId: 'ambient-tea',
    agentName: 'Bé Matcha (Chill)',
    status: 'Idle',
    department: STATUS_META.Idle.dept,
    reportText: 'Vừa xong task! Đang ngồi ghế sofa thưởng thức chén trà hoa cúc ấm áp 🍵',
    progress: 100,
    stageLabel: 'Tầng 1 • Uống trà chiều',
    color: '#2dd4bf',
    hairColor: '#0f766e',
    hairStyle: 'spiky',
    isAmbient: true,
  },
];

const AMBIENT_SCRIPT = [
  {
    status: 'Write',
    reportText: 'Đang ngồi ghế Tầng 1 code tích cực, gần xong tính năng rồi! ✍️',
    stageLabel: 'Tầng 1 • Lập trình',
    progress: 76,
  },
  {
    status: 'Browser',
    reportText: 'Chạy ra Đài Quả Địa Cầu trung tâm kiểm tra dữ liệu thời gian thực 🌐',
    stageLabel: 'Trung Tâm • Quả Địa Cầu',
    progress: 85,
  },
  {
    status: 'Read',
    reportText: 'Vừa leo cầu thang lên Tầng 2 vào Meeting Room họp & đọc spec 📋',
    stageLabel: 'Tầng 2 • Meeting Room',
    progress: 55,
  },
  {
    status: 'Idle',
    reportText: 'Xong việc rồi! Xuống cầu thang ngồi sofa uống chén trà nóng thư giãn 🍵',
    stageLabel: 'Tầng 1 • Uống trà sofa',
    progress: 100,
  },
  {
    status: 'Waiting',
    reportText: 'Đang ngồi bàn điều phối Tầng 1 chờ sếp giao nhiệm vụ tiếp theo 🙋‍♀️',
    stageLabel: 'Tầng 1 • Chờ duyệt',
    progress: 50,
  },
];

function createSignTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function GlassWall({ position, size, rotation = [0, 0, 0], decalTexture = null }) {
  const [w, h, d] = size;
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial
          color="#cceeff"
          transparent
          opacity={0.18}
          roughness={0.05}
          metalness={0.1}
          transmission={0.35}
          depthWrite={false}
        />
      </mesh>
      {decalTexture && (
        <mesh position={[0, 0.05, d / 2 + 0.01]}>
          <planeGeometry args={[w * 0.78, h * 0.65]} />
          <meshBasicMaterial map={decalTexture} transparent />
        </mesh>
      )}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.04, 0.05, d + 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.025, 0]}>
        <boxGeometry args={[w + 0.04, 0.05, d + 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]}>
        <boxGeometry args={[0.05, h, d + 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[w / 2, 0, 0]}>
        <boxGeometry args={[0.05, h, d + 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ErgonomicChair({ position, rotation = [0, 0, 0], accent = '#22c55e', body = '#1e293b' }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.05, 5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.32, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>
      <RoundedBox args={[0.48, 0.09, 0.46]} radius={0.04} position={[0, 0.41, 0]} castShadow>
        <meshStandardMaterial color={body} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[0.05, 0.18, 0.3]} radius={0.02} position={[-0.25, 0.52, 0]}>
        <meshStandardMaterial color="#334155" />
      </RoundedBox>
      <RoundedBox args={[0.05, 0.18, 0.3]} radius={0.02} position={[0.25, 0.52, 0]}>
        <meshStandardMaterial color="#334155" />
      </RoundedBox>
      <RoundedBox args={[0.45, 0.56, 0.08]} radius={0.04} position={[0, 0.72, -0.2]} castShadow>
        <meshStandardMaterial color={body} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[0.28, 0.38, 0.085]} radius={0.03} position={[0, 0.72, -0.2]}>
        <meshStandardMaterial color={accent} roughness={0.5} />
      </RoundedBox>
    </group>
  );
}

function WorkstationDesk({
  position,
  rotation = [0, 0, 0],
  width = 2.6,
  screenColor = '#38bdf8',
  monitors = 2,
  chairAccent = '#22c55e',
  chairPosOffset = [0, 0, 0.75],
  chairRotY = Math.PI,
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Sleek White Desk Surface */}
      <RoundedBox args={[width, 0.07, 1.0]} radius={0.025} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </RoundedBox>
      {/* Side pedestals */}
      <RoundedBox args={[0.42, 0.72, 0.88]} radius={0.02} position={[-width / 2 + 0.24, 0.36, 0]} castShadow>
        <meshStandardMaterial color="#e2e8f0" roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.72, 0.88]} radius={0.02} position={[width / 2 - 0.24, 0.36, 0]} castShadow>
        <meshStandardMaterial color="#e2e8f0" roughness={0.45} />
      </RoundedBox>
      {/* Warm under-desk LED glow */}
      <mesh position={[0, 0.69, 0.45]}>
        <boxGeometry args={[width - 0.5, 0.02, 0.02]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.4} />
      </mesh>
      {/* Monitors */}
      {Array.from({ length: monitors }).map((_, i) => {
        const offsetX = (i - (monitors - 1) / 2) * 0.72;
        return (
          <group key={i} position={[offsetX, 1.02, -0.18]}>
            <RoundedBox args={[0.62, 0.38, 0.035]} radius={0.01} castShadow>
              <meshStandardMaterial color="#0f172a" roughness={0.35} />
            </RoundedBox>
            <mesh position={[0, 0, 0.02]}>
              <planeGeometry args={[0.57, 0.33]} />
              <meshStandardMaterial
                color={screenColor}
                emissive={screenColor}
                emissiveIntensity={0.65}
              />
            </mesh>
            <mesh position={[0, -0.23, -0.02]}>
              <boxGeometry args={[0.07, 0.14, 0.04]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        );
      })}
      {/* Keyboards */}
      <mesh position={[0, 0.785, 0.18]} castShadow>
        <boxGeometry args={[0.46, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Chair */}
      <ErgonomicChair
        position={chairPosOffset}
        rotation={[0, chairRotY, 0]}
        accent={chairAccent}
      />
    </group>
  );
}

function TropicalPlant({ position, scale = 1, potColor = '#f8fafc' }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.48, 16]} />
        <meshStandardMaterial color={potColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 14]} />
        <meshStandardMaterial color="#57534e" />
      </mesh>
      {/* Lush foliage cluster */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <dodecahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color="#15803d" roughness={0.7} />
      </mesh>
      <mesh position={[0.16, 0.92, 0.1]} castShadow>
        <dodecahedronGeometry args={[0.24, 1]} />
        <meshStandardMaterial color="#22c55e" roughness={0.7} />
      </mesh>
      <mesh position={[-0.16, 0.88, -0.1]} castShadow>
        <dodecahedronGeometry args={[0.24, 1]} />
        <meshStandardMaterial color="#4ade80" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, -0.04]} castShadow>
        <dodecahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#16a34a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function HologramEarthMonument({ position }) {
  const globeRef = useRef();
  const wireRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  useFrame((_, delta) => {
    if (globeRef.current) globeRef.current.rotation.y += delta * 0.45;
    if (wireRef.current) wireRef.current.rotation.y -= delta * 0.25;
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 0.6;
    if (ring2Ref.current) ring2Ref.current.rotation.x -= delta * 0.45;
  });

  return (
    <group position={position}>
      {/* Multi-tier glowing cyan pedestal */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.25, 0.16, 48]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.95, 2.12, 48]} />
        <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[0, 0.24, 0]} receiveShadow>
        <cylinderGeometry args={[1.55, 1.7, 0.16, 48]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.38, 1.54, 48]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 0.14, 40]} />
        <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1.2} />
      </mesh>

      {/* Vertical projection light column */}
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 2.8, 32, 1, true]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Giant Glowing Blue Hologram Earth */}
      <mesh ref={globeRef} position={[0, 1.82, 0]}>
        <sphereGeometry args={[1.02, 32, 32]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0284c7"
          emissiveIntensity={1.35}
          transparent
          opacity={0.78}
          roughness={0.15}
        />
      </mesh>
      {/* Glowing wireframe grid over Earth */}
      <mesh ref={wireRef} position={[0, 1.82, 0]}>
        <sphereGeometry args={[1.045, 22, 16]} />
        <meshBasicMaterial color="#7dd3fc" wireframe transparent opacity={0.55} />
      </mesh>

      {/* Orbiting energy rings */}
      <mesh ref={ring1Ref} position={[0, 1.82, 0]} rotation={[Math.PI / 2.6, 0.25, 0]}>
        <torusGeometry args={[1.38, 0.022, 12, 64]} />
        <meshStandardMaterial color="#38bdf8" emissive="#00e5ff" emissiveIntensity={2} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 1.82, 0]} rotation={[-Math.PI / 3, -0.3, 0]}>
        <torusGeometry args={[1.52, 0.016, 10, 64]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.6} />
      </mesh>

      {/* Emitter ring under ceiling / mezzanine */}
      <mesh position={[0, 3.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.06, 12, 48]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#38bdf8" emissiveIntensity={0.9} />
      </mesh>
      <pointLight position={[0, 1.8, 0]} color="#38bdf8" intensity={6} distance={7.5} decay={2} />
    </group>
  );
}

function LedStaircase() {
  const steps = 12;
  const totalHeight = 3.4;
  const startZ = 3.1;
  const endZ = -1.9;
  const stepH = totalHeight / steps;
  const stepD = (startZ - endZ) / steps;

  return (
    <group position={[6.6, 0, 0]}>
      {Array.from({ length: steps }).map((_, i) => {
        const y = (i + 0.5) * stepH;
        const z = startZ - (i + 0.5) * stepD;
        return (
          <group key={i} position={[0, y, z]}>
            {/* Wood tread */}
            <RoundedBox args={[1.45, 0.08, stepD + 0.06]} radius={0.015} castShadow receiveShadow>
              <meshStandardMaterial color="#d4a373" roughness={0.55} />
            </RoundedBox>
            {/* Warm LED underglow strip on every step */}
            <mesh position={[0, -0.045, stepD / 2]}>
              <boxGeometry args={[1.38, 0.025, 0.04]} />
              <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.2} />
            </mesh>
          </group>
        );
      })}
      {/* Stair side stringers */}
      <mesh position={[-0.76, 1.7, 0.6]} rotation={[0.59, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.22, 6.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.76, 1.7, 0.6]} rotation={[0.59, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.22, 6.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Sleek Glass Balustrades */}
      <mesh position={[-0.76, 2.25, 0.6]} rotation={[0.59, 0, 0]}>
        <boxGeometry args={[0.03, 0.9, 6.0]} />
        <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0.76, 2.25, 0.6]} rotation={[0.59, 0, 0]}>
        <boxGeometry args={[0.03, 0.9, 6.0]} />
        <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* Top handrail bars */}
      <mesh position={[-0.76, 2.7, 0.6]} rotation={[0.59, 0, 0]}>
        <boxGeometry args={[0.06, 0.05, 6.1]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0.76, 2.7, 0.6]} rotation={[0.59, 0, 0]}>
        <boxGeometry args={[0.06, 0.05, 6.1]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.2} />
      </mesh>
    </group>
  );
}

function OfficeEnvironment() {
  const aiWallTex = useMemo(
    () =>
      createSignTexture(1024, 384, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#091e4a');
        grad.addColorStop(0.5, '#0f3b8c');
        grad.addColorStop(1, '#082f6e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Glowing tech arcs
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w * 0.72, h * 0.55, 160, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui, sans-serif';
        ctx.fillText('AI OFFICE', 70, 145);

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '600 34px system-ui, sans-serif';
        ctx.fillText('Work Smarter,', 70, 210);
        ctx.fillText('Live Better', 70, 255);
      }),
    []
  );

  const featureBoardTex = useMemo(
    () =>
      createSignTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        const items = [
          { icon: '🧠', text: 'Local AI' },
          { icon: '⚡', text: 'Automation' },
          { icon: '📈', text: 'Productivity' },
          { icon: '💡', text: 'Innovation' },
        ];
        items.forEach((item, idx) => {
          const y = 105 + idx * 102;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.fillRect(42, y - 48, w - 84, 72);
          ctx.fillStyle = '#38bdf8';
          ctx.font = '34px system-ui';
          ctx.fillText(item.icon, 65, y);
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 34px system-ui, sans-serif';
          ctx.fillText(item.text, 130, y);
        });
      }),
    []
  );

  const vhnTex = useMemo(
    () =>
      createSignTexture(512, 320, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        // Blue gradient V logo
        const grad = ctx.createLinearGradient(150, 20, 360, 180);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#2563eb');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(155, 45);
        ctx.lineTo(220, 45);
        ctx.lineTo(256, 135);
        ctx.lineTo(292, 45);
        ctx.lineTo(357, 45);
        ctx.lineTo(278, 195);
        ctx.lineTo(234, 195);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 72px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VHN', w / 2, 280);
      }),
    []
  );

  const meetingGlassTex = useMemo(
    () =>
      createSignTexture(768, 384, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👥  Meeting Room', w / 2, 72);

        // Glowing holographic chart box
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 5;
        ctx.strokeRect(120, 115, w - 240, 220);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
        ctx.fillRect(120, 115, w - 240, 220);

        const bars = [65, 95, 75, 125, 110, 155, 140];
        bars.forEach((bh, idx) => {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(165 + idx * 65, 305 - bh, 36, bh);
        });
      }),
    []
  );

  const dreamBigTex = useMemo(
    () =>
      createSignTexture(512, 320, (ctx, w, h) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, w, h);
        ctx.font = '68px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🚀', w / 2, 120);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.fillText('Dream Big', w / 2, 200);
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '600 32px system-ui, sans-serif';
        ctx.fillText('Build Tomorrow', w / 2, 250);
      }),
    []
  );

  return (
    <group>
      {/* ================= BASE PLATFORM & GLOSSY GROUND FLOOR (TẦNG 1) ================= */}
      <RoundedBox args={[16.8, 0.36, 13.8]} radius={0.14} position={[0, -0.22, 0]} receiveShadow>
        <meshStandardMaterial color="#0f172a" roughness={0.75} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[16.2, 0.06, 13.2]} />
        <meshStandardMaterial color="#d8e0e8" roughness={0.22} metalness={0.14} />
      </mesh>
      {/* Subtle architectural floor grid */}
      {[-5.5, -3.5, -1.5, 0.5, 2.5, 4.5].map((z) => (
        <mesh key={z} position={[0, 0.012, z]}>
          <boxGeometry args={[16.0, 0.002, 0.02]} />
          <meshBasicMaterial color="#cbd5e1" />
        </mesh>
      ))}

      {/* ================= BACK WALLS & SKYLINE GLASS WINDOWS ================= */}
      {/* North Back Wall */}
      <mesh position={[0, 3.3, -6.5]} castShadow receiveShadow>
        <boxGeometry args={[16.2, 6.6, 0.28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {/* Giant Glowing "AI OFFICE" Video Wall on Ground Floor North Wall */}
      <mesh position={[0.1, 1.65, -6.33]}>
        <planeGeometry args={[7.2, 2.7]} />
        <meshStandardMaterial map={aiWallTex} emissive="#0284c7" emissiveIntensity={0.45} />
      </mesh>
      {/* Recessed Warm-Lit Bookshelf to the right of Video Wall */}
      <group position={[4.75, 0, -6.15]}>
        <RoundedBox args={[1.95, 2.75, 0.45]} radius={0.03} position={[0, 1.38, 0]} castShadow>
          <meshStandardMaterial color="#8b5a2b" roughness={0.55} />
        </RoundedBox>
        {[0.5, 1.05, 1.6, 2.15].map((y, idx) => (
          <group key={y} position={[0, y, 0.06]}>
            <mesh>
              <boxGeometry args={[1.8, 0.05, 0.38]} />
              <meshStandardMaterial color="#5c3a1b" />
            </mesh>
            {[-0.65, -0.4, -0.15, 0.1, 0.35, 0.6].map((bx, bIdx) => (
              <mesh key={bIdx} position={[bx, 0.19, 0]} castShadow>
                <boxGeometry args={[0.14, 0.3 + ((idx + bIdx) % 2) * 0.05, 0.24]} />
                <meshStandardMaterial
                  color={['#ef4444', '#38bdf8', '#f59e0b', '#10b981', '#a855f7'][(idx + bIdx) % 5]}
                />
              </mesh>
            ))}
          </group>
        ))}
        <pointLight position={[0, 2.4, 0.4]} color="#ffd27d" intensity={2.2} distance={4} />
      </group>

      {/* Dark Accent Wall with "Dream Big, Build Tomorrow" */}
      <mesh position={[6.5, 1.55, -5.6]} rotation={[0, -0.3, 0]}>
        <planeGeometry args={[1.9, 1.25]} />
        <meshStandardMaterial map={dreamBigTex} emissive="#38bdf8" emissiveIntensity={0.22} />
      </mesh>

      {/* Left Glass Windows (West Perimeter) */}
      <GlassWall position={[-8.05, 1.65, -2.2]} size={[0.08, 3.2, 8.2]} />
      <GlassWall position={[-8.05, 4.95, -2.2]} size={[0.08, 3.0, 8.2]} />
      {/* Right Glass Windows (East Perimeter) */}
      <GlassWall position={[8.05, 4.95, -3.5]} size={[0.08, 3.0, 5.8]} />

      {/* ================= LEFT WOOD-SLAT VHN FEATURE TOWER ================= */}
      <group position={[-6.7, 0, 1.4]}>
        {/* Vertical Wood-slat Tower */}
        <RoundedBox args={[1.65, 6.5, 1.8]} radius={0.05} position={[0, 3.25, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#9c6638" roughness={0.6} />
        </RoundedBox>
        {[-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map((offset) => (
          <mesh key={offset} position={[offset, 3.25, 0.91]}>
            <boxGeometry args={[0.06, 6.4, 0.04]} />
            <meshStandardMaterial color="#6e4422" />
          </mesh>
        ))}
        {/* Glowing V / VHN Logo on Upper Floor */}
        <mesh position={[0, 4.85, 0.95]}>
          <planeGeometry args={[1.45, 1.1]} />
          <meshBasicMaterial map={vhnTex} transparent />
        </mesh>
        {/* Glowing Feature Board (Local AI / Automation / Productivity / Innovation) */}
        <mesh position={[0, 1.8, 0.95]}>
          <planeGeometry args={[1.45, 1.55]} />
          <meshStandardMaterial map={featureBoardTex} emissive="#0ea5e9" emissiveIntensity={0.25} />
        </mesh>
      </group>

      {/* ================= CENTER GIANT HOLOGRAM EARTH (BROWSER ZONE) ================= */}
      <HologramEarthMonument position={[0.2, 0, 0.6]} />

      {/* ================= GROUND FLOOR WORKSTATIONS (WRITE & WAITING ZONES) ================= */}
      {/* Front-Left Command / Waiting Desk + Cyan Planter Box */}
      <WorkstationDesk
        position={[-4.15, 0, 3.6]}
        width={3.1}
        monitors={3}
        screenColor="#fb7185"
        chairAccent="#fb7185"
        chairPosOffset={[-0.65, 0, -0.95]}
        chairRotY={0}
      />
      <ErgonomicChair position={[-3.5, 0, 2.65]} rotation={[0, 0, 0]} accent="#fb7185" />
      {/* Foreground White Planter with Glowing Blue LED Base */}
      <group position={[-5.9, 0, 5.4]}>
        <RoundedBox args={[2.3, 0.62, 0.85]} radius={0.05} position={[0, 0.31, 0]} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0.54, 0.43]}>
          <boxGeometry args={[2.1, 0.03, 0.02]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2} />
        </mesh>
        <TropicalPlant position={[-0.6, 0.35, 0]} scale={0.75} />
        <TropicalPlant position={[0.55, 0.35, 0]} scale={0.85} />
      </group>

      {/* Mid-Left & Mid-Right Coding Desk Pods (Write Zone) */}
      <WorkstationDesk
        position={[-3.4, 0, -2.35]}
        width={3.1}
        monitors={3}
        screenColor="#4ade80"
        chairAccent="#22c55e"
        chairPosOffset={[-0.7, 0, 0.9]}
      />
      <ErgonomicChair position={[-2.7, 0, -1.45]} rotation={[0, Math.PI, 0]} accent="#22c55e" />

      <WorkstationDesk
        position={[3.4, 0, -2.35]}
        width={3.1}
        monitors={3}
        screenColor="#38bdf8"
        chairAccent="#22c55e"
        chairPosOffset={[-0.7, 0, 0.9]}
      />
      <ErgonomicChair position={[4.1, 0, -1.45]} rotation={[0, Math.PI, 0]} accent="#22c55e" />

      {/* ================= FRONT-RIGHT CURVED SOFA & TEA LOUNGE (IDLE ZONE) ================= */}
      <group position={[3.4, 0, 4.1]}>
        {/* Large Round Grey Rug */}
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.25, 40]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.92} />
        </mesh>

        {/* Curved Light-Grey Modular Sofa (made of 5 curved blocks) */}
        {[
          { x: -1.15, z: 0.45, ry: 0.65, pillow: '#f59e0b' },
          { x: -0.55, z: 0.85, ry: 0.25, pillow: '#fbbf24' },
          { x: 0.15, z: 0.92, ry: 0, pillow: '#f59e0b' },
          { x: 0.85, z: 0.78, ry: -0.35, pillow: '#fbbf24' },
          { x: 1.32, z: 0.32, ry: -0.8, pillow: '#f59e0b' },
        ].map((seg, idx) => (
          <group key={idx} position={[seg.x, 0, seg.z]} rotation={[0, seg.ry, 0]}>
            <RoundedBox args={[0.82, 0.34, 0.78]} radius={0.1} position={[0, 0.2, 0]} castShadow receiveShadow>
              <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
            </RoundedBox>
            <RoundedBox args={[0.82, 0.46, 0.22]} radius={0.08} position={[0, 0.48, 0.28]} castShadow>
              <meshStandardMaterial color="#94a3b8" roughness={0.8} />
            </RoundedBox>
            {/* Mustard-yellow throw pillow */}
            <RoundedBox args={[0.3, 0.28, 0.13]} radius={0.05} position={[0, 0.45, 0.1]} rotation={[0.2, 0, 0.12]} castShadow>
              <meshStandardMaterial color={seg.pillow} roughness={0.65} />
            </RoundedBox>
          </group>
        ))}

        {/* Round Mustard-Yellow Pouf Ottoman */}
        <mesh position={[-1.8, 0.22, 0.25]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.42, 24]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.75} />
        </mesh>

        {/* Round White Tea Table with Teapot & Teacups */}
        <group position={[0, 0, -0.25]}>
          <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.72, 0.72, 0.06, 32]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.19, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.28, 0.36, 18]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Ceramic Teapot */}
          <mesh position={[-0.15, 0.48, 0.05]} castShadow>
            <sphereGeometry args={[0.11, 14, 14]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.25} />
          </mesh>
          {/* Teacups */}
          {[
            [0.2, 0.12],
            [0.12, -0.2],
            [-0.22, -0.18],
          ].map(([cx, cz], idx) => (
            <mesh key={idx} position={[cx, 0.45, cz]} castShadow>
              <cylinderGeometry args={[0.055, 0.04, 0.08, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ================= RIGHT SIDE LED STAIRCASE ================= */}
      <LedStaircase />

      {/* ================= 2ND FLOOR MEZZANINE (TẦNG 2, y = 3.4) ================= */}
      <group position={[0, 3.4, 0]}>
        {/* Mezzanine Floor Slab (spanning from Left Wood Tower to Right Staircase) */}
        <RoundedBox args={[12.8, 0.28, 5.4]} radius={0.06} position={[1.2, -0.14, -3.7]} castShadow receiveShadow>
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </RoundedBox>
        {/* Warm continuous LED strip under the Mezzanine front edge */}
        <mesh position={[0.45, -0.27, -1.03]}>
          <boxGeometry args={[11.2, 0.035, 0.06]} />
          <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.0} />
        </mesh>

        {/* Glass Balcony Guardrail along z = -1.05 */}
        <GlassWall position={[-2.2, 0.5, -1.05]} size={[6.2, 0.95, 0.05]} />
        <GlassWall position={[3.3, 0.5, -1.05]} size={[4.8, 0.95, 0.05]} />

        {/* Potted Plants lining the 2nd Floor Balcony */}
        <TropicalPlant position={[-4.7, 0, -1.35]} scale={0.9} />
        <TropicalPlant position={[-0.2, 0, -1.35]} scale={0.85} />
        <TropicalPlant position={[5.8, 0, -1.35]} scale={0.9} />

        {/* 2nd Floor Left Balcony Desks (Read Zone) */}
        <WorkstationDesk
          position={[-2.2, 0, -3.05]}
          width={3.2}
          monitors={3}
          screenColor="#fbbf24"
          chairAccent="#fbbf24"
          chairPosOffset={[-0.8, 0, 0.9]}
        />
        <ErgonomicChair position={[-1.4, 0, -2.15]} rotation={[0, Math.PI, 0]} accent="#fbbf24" />

        {/* 2nd Floor Right Glass-Enclosed "Meeting Room" */}
        <group position={[2.85, 0, -3.7]}>
          {/* Glass Walls with "Meeting Room" & Holographic Chart Decal */}
          <GlassWall
            position={[0, 1.4, 1.55]}
            size={[4.5, 2.75, 0.06]}
            decalTexture={meetingGlassTex}
          />
          <GlassWall position={[-2.25, 1.4, 0]} size={[0.06, 2.75, 3.1]} />
          <GlassWall position={[2.25, 1.4, 0]} size={[0.06, 2.75, 3.1]} />

          {/* Meeting Conference Table */}
          <RoundedBox args={[2.8, 0.08, 1.2]} radius={0.04} position={[0, 0.74, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#e2b47e" roughness={0.45} />
          </RoundedBox>
          <mesh position={[0, 0.37, 0]}>
            <boxGeometry args={[1.6, 0.7, 0.45]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Meeting Chairs */}
          <ErgonomicChair position={[-0.75, 0, 0.65]} rotation={[0, Math.PI, 0]} accent="#38bdf8" />
          <ErgonomicChair position={[0.75, 0, 0.65]} rotation={[0, Math.PI, 0]} accent="#38bdf8" />
          <ErgonomicChair position={[-0.75, 0, -0.7]} rotation={[0, 0, 0]} accent="#38bdf8" />
          <ErgonomicChair position={[0.75, 0, -0.7]} rotation={[0, 0, 0]} accent="#38bdf8" />
        </group>
      </group>

      {/* ================= HIGH CEILING RING CHANDELIER (y = 6.5) ================= */}
      <group position={[0.2, 6.4, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.9, 0.1, 14, 64]} />
          <meshStandardMaterial color="#ffffff" emissive="#fef9c3" emissiveIntensity={2.0} />
        </mesh>
        <pointLight position={[0, -0.5, 0]} color="#fff7ed" intensity={4.5} distance={14} decay={1.5} />
      </group>

      {/* ================= TROPICAL INDOOR PLANTS ================= */}
      <TropicalPlant position={[-7.3, 0, 4.4]} scale={1.25} />
      <TropicalPlant position={[-5.3, 0, -5.2]} scale={1.1} />
      <TropicalPlant position={[5.6, 0, 2.2]} scale={1.15} />
      <TropicalPlant position={[7.2, 0, 4.8]} scale={1.2} />
      <TropicalPlant position={[2.6, 0, -5.6]} scale={1.0} />

      {/* ================= VIETNAMESE DEPARTMENT SIGNS ================= */}
      <Html position={[-3.3, 0.18, -0.8]} center distanceFactor={19} zIndexRange={[2, 0]}>
        <ZoneBadge title="TẦNG 1 • KHU LẬP TRÌNH (Write)" color="#4ade80" icon={Pencil} />
      </Html>
      <Html position={[0.2, 0.25, 2.7]} center distanceFactor={19} zIndexRange={[2, 0]}>
        <ZoneBadge title="ĐÀI QUẢ ĐỊA CẦU AI (Browser)" color="#38bdf8" icon={Globe} />
      </Html>
      <Html position={[3.4, 0.18, 5.95]} center distanceFactor={19} zIndexRange={[2, 0]}>
        <ZoneBadge title="SOFA THƯỞNG TRÀ (Idle)" color="#2dd4bf" icon={Coffee} />
      </Html>
      <Html position={[-4.2, 0.18, 5.2]} center distanceFactor={19} zIndexRange={[2, 0]}>
        <ZoneBadge title="BÀN ĐIỀU PHỐI (Waiting)" color="#fb7185" icon={Hourglass} />
      </Html>
      <Html position={[0.5, 3.65, -0.8]} center distanceFactor={19} zIndexRange={[2, 0]}>
        <ZoneBadge title="TẦNG 2 • PHÒNG HỌP & NGHIÊN CỨU (Read)" color="#fbbf24" icon={BookOpen} />
      </Html>
    </group>
  );
}

function ZoneBadge({ title, color, icon: Icon }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '999px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: `1.5px solid ${color}`,
        color: '#f8fafc',
        fontSize: '10px',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: `0 4px 10px rgba(0,0,0,0.4)`,
      }}
    >
      <Icon size={11} color={color} />
      <span>{title}</span>
    </div>
  );
}

function ChibiHair({ style = 'buns', color = '#1e293b' }) {
  return (
    <group>
      {/* Base hair dome */}
      <mesh position={[0, 0.06, -0.02]} castShadow>
        <sphereGeometry args={[0.355, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Cute front bangs */}
      <RoundedBox args={[0.46, 0.14, 0.16]} radius={0.06} position={[0, 0.16, 0.25]} rotation={[0.2, 0, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </RoundedBox>
      {/* Side locks */}
      <mesh position={[-0.3, -0.04, 0.12]} castShadow>
        <capsuleGeometry args={[0.065, 0.2, 6, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0.3, -0.04, 0.12]} castShadow>
        <capsuleGeometry args={[0.065, 0.2, 6, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {style === 'buns' && (
        <>
          <mesh position={[-0.28, 0.3, -0.06]} castShadow>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
          <mesh position={[0.28, 0.3, -0.06]} castShadow>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        </>
      )}
      {style === 'ponytail' && (
        <mesh position={[0, 0.12, -0.36]} rotation={[0.5, 0, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.26, 8, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      )}
      {style === 'spiky' && (
        <>
          <mesh position={[-0.1, 0.38, 0]} rotation={[0, 0, 0.3]} castShadow>
            <coneGeometry args={[0.09, 0.2, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0.1, 0.39, 0.04]} rotation={[0.1, 0, -0.25]} castShadow>
            <coneGeometry args={[0.09, 0.22, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </>
      )}
    </group>
  );
}

function ChibiAgent({ agent, slotIndex }) {
  const rootRef = useRef();
  const bodyRigRef = useRef();
  const headRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const steam1Ref = useRef();
  const steam2Ref = useRef();
  const holoRef = useRef();

  const seats = ZONE_SEATS[agent.status] || ZONE_SEATS.Idle;
  const seat = seats[slotIndex % seats.length];
  const targetVec = useMemo(() => new THREE.Vector3(seat[0], seat[1], seat[2]), [seat[0], seat[1], seat[2]]);
  const seatRotY = seat[3];
  const pose = seat[4];

  const waypointsRef = useRef([]);
  const initializedRef = useRef(false);

  // Build stair waypoints automatically when target floor changes
  useEffect(() => {
    const g = rootRef.current;
    if (!g) return;

    if (!initializedRef.current) {
      g.position.set(seat[0], seat[1], seat[2]);
      g.rotation.y = seatRotY;
      initializedRef.current = true;
      waypointsRef.current = [];
      return;
    }

    const curY = g.position.y;
    const tgtY = targetVec.y;
    const queue = [];

    if (curY < 1.5 && tgtY > 2.0) {
      // Climb UP stairs from Floor 1 to Floor 2
      queue.push(new THREE.Vector3(...STAIR_BOTTOM));
      queue.push(new THREE.Vector3(...STAIR_MID));
      queue.push(new THREE.Vector3(...STAIR_TOP));
    } else if (curY > 2.0 && tgtY < 1.5) {
      // Walk DOWN stairs from Floor 2 to Floor 1
      queue.push(new THREE.Vector3(...STAIR_TOP));
      queue.push(new THREE.Vector3(...STAIR_MID));
      queue.push(new THREE.Vector3(...STAIR_BOTTOM));
    }
    queue.push(targetVec.clone());
    waypointsRef.current = queue;
  }, [targetVec, seatRotY]);

  const meta = STATUS_META[agent.status] || STATUS_META.Idle;
  const outfitColor = agent.color || meta.neon;
  const hairColor = agent.hairColor || '#1e293b';
  const hairStyle = agent.hairStyle || ['buns', 'ponytail', 'bob', 'spiky'][slotIndex % 4];

  useFrame((state, delta) => {
    const g = rootRef.current;
    const rig = bodyRigRef.current;
    if (!g || !rig) return;

    const t = state.clock.elapsedTime;
    const queue = waypointsRef.current;
    const isMoving = queue.length > 0;

    // Natural eye blinking every ~3.6s
    const blinkCycle = (t + slotIndex * 0.9) % 3.6;
    const eyeScaleY = blinkCycle > 3.46 ? 0.12 : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;

    if (isMoving) {
      // Stand upright while walking/running
      rig.position.y = THREE.MathUtils.lerp(rig.position.y, 0, 0.25);

      const nextWp = queue[0];
      const stepDist = g.position.distanceTo(nextWp);
      const speed = 3.8 * delta;

      if (stepDist <= speed + 0.05) {
        g.position.copy(nextWp);
        queue.shift();
      } else {
        const dir = nextWp.clone().sub(g.position).normalize();
        g.position.addScaledVector(dir, speed);
        const walkAngle = Math.atan2(dir.x, dir.z);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, walkAngle, Math.min(1, delta * 10));
      }

      // Adorable bouncy chibi running cycle
      const swing = Math.sin(t * 14) * 0.68;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.8;
      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(t * 7) * 0.08;
        headRef.current.rotation.x = 0.05;
      }
      rig.position.y = Math.abs(Math.sin(t * 14)) * 0.09;
    } else {
      // Smoothly face chair/desk/tea-table direction
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, seatRotY, Math.min(1, delta * 6));

      if (pose === 'sit_desk') {
        // Sit down cleanly onto the ergonomic chair seat
        rig.position.y = THREE.MathUtils.lerp(rig.position.y, 0.08, 0.18);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, -Math.PI / 2.1, 0.2);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -Math.PI / 2.1, 0.2);

        if (agent.status === 'Waiting') {
          // Raise right hand politely & look around
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.3;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -2.3 + Math.sin(t * 8) * 0.25;
          if (headRef.current) headRef.current.rotation.y = Math.sin(t * 2.2) * 0.25;
        } else {
          // Typing rapidly on keyboard
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.78 + Math.sin(t * 18) * 0.18;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.78 + Math.cos(t * 18) * 0.18;
          if (headRef.current) {
            headRef.current.rotation.x = 0.12 + Math.sin(t * 4) * 0.04;
            headRef.current.rotation.z = Math.sin(t * 2) * 0.04;
          }
        }
      } else if (pose === 'sit_sofa') {
        // Relaxed sitting on sofa & drinking warm tea
        rig.position.y = THREE.MathUtils.lerp(rig.position.y, 0.05, 0.18);
        const footKick = Math.sin(t * 3 + slotIndex) * 0.15;
        if (leftLegRef.current) leftLegRef.current.rotation.x = -Math.PI / 2.1 + footKick;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.PI / 2.1 - footKick;

        // Sipping tea cycle every ~4.5 seconds
        const sipPhase = (t + slotIndex * 1.3) % 4.5;
        const isSipping = sipPhase > 2.8 && sipPhase < 4.1;
        const targetArmX = isSipping ? -1.45 : -0.55 + Math.sin(t * 2.2) * 0.06;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.25, 0.15);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targetArmX, 0.12);

        if (headRef.current) {
          headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, isSipping ? -0.15 : 0.04, 0.12);
          headRef.current.rotation.z = Math.sin(t * 2.2) * 0.06;
        }

        // Floating steam particles from teacup
        if (steam1Ref.current) {
          const s1 = (t * 0.8) % 1;
          steam1Ref.current.position.y = 0.1 + s1 * 0.25;
          steam1Ref.current.material.opacity = (1 - s1) * 0.7;
        }
        if (steam2Ref.current) {
          const s2 = (t * 0.8 + 0.5) % 1;
          steam2Ref.current.position.y = 0.1 + s2 * 0.25;
          steam2Ref.current.material.opacity = (1 - s2) * 0.7;
        }
      } else {
        // Standing near Hologram Globe
        rig.position.y = Math.sin(t * 2.6 + slotIndex) * 0.025;
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.2);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.2);
        if (leftArmRef.current) leftArmRef.current.rotation.x = -0.65;
        if (rightArmRef.current) rightArmRef.current.rotation.x = -0.9 + Math.sin(t * 5) * 0.15;
        if (headRef.current) headRef.current.rotation.x = -0.18;
      }
    }

    if (holoRef.current) {
      holoRef.current.position.y = 0.62 + Math.sin(t * 4) * 0.03;
    }
  });

  const Icon = meta.icon;
  const showHologram =
    waypointsRef.current.length === 0 &&
    (agent.status === 'Write' || agent.status === 'Read' || agent.status === 'Browser');

  return (
    <group ref={rootRef}>
      {/* Floor Status Aura Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.28, 0.37, 28]} />
        <meshBasicMaterial color={meta.neon} transparent opacity={0.75} />
      </mesh>

      <group ref={bodyRigRef}>
        {/* Stubby Cute Legs + Chunky White Sneakers */}
        <group ref={leftLegRef} position={[-0.1, 0.22, 0]}>
          <mesh position={[0, -0.05, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.14, 6, 10]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          <RoundedBox args={[0.15, 0.09, 0.22]} radius={0.04} position={[0, -0.16, 0.03]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.35} />
          </RoundedBox>
        </group>
        <group ref={rightLegRef} position={[0.1, 0.22, 0]}>
          <mesh position={[0, -0.05, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.14, 6, 10]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          <RoundedBox args={[0.15, 0.09, 0.22]} radius={0.04} position={[0, -0.16, 0.03]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.35} />
          </RoundedBox>
        </group>

        {/* Adorable Chubby Hoodie Body + Collar + Mini Backpack */}
        <group position={[0, 0.5, 0]}>
          <RoundedBox args={[0.44, 0.4, 0.34]} radius={0.15} castShadow>
            <meshStandardMaterial color={outfitColor} roughness={0.42} />
          </RoundedBox>
          <RoundedBox args={[0.24, 0.12, 0.35]} radius={0.04} position={[0, 0.12, 0.01]}>
            <meshStandardMaterial color="#ffffff" />
          </RoundedBox>
          {/* Cute little bow/tie */}
          <mesh position={[0, 0.06, 0.185]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color={meta.neon} />
          </mesh>
          {/* Backpack */}
          <RoundedBox args={[0.3, 0.28, 0.15]} radius={0.06} position={[0, 0.02, -0.2]} castShadow>
            <meshStandardMaterial color="#334155" roughness={0.5} />
          </RoundedBox>
        </group>

        {/* Left & Right Arms + Cute Round Hands */}
        <group ref={leftArmRef} position={[-0.27, 0.6, 0]} rotation={[0, 0, 0.18]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.064, 0.15, 6, 10]} />
            <meshStandardMaterial color={outfitColor} roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.065, 12, 12]} />
            <meshStandardMaterial color="#ffe5d8" roughness={0.5} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.27, 0.6, 0]} rotation={[0, 0, -0.18]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.064, 0.15, 6, 10]} />
            <meshStandardMaterial color={outfitColor} roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.065, 12, 12]} />
            <meshStandardMaterial color="#ffe5d8" roughness={0.5} />
          </mesh>

          {/* Warm Teacup + Steam Particles when drinking tea (Idle) */}
          {agent.status === 'Idle' && (
            <group position={[0, -0.24, 0.09]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.06, 0.045, 0.1, 14]} />
                <meshStandardMaterial color="#fef3c7" roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.05, 12]} />
                <meshBasicMaterial color="#65a30d" />
              </mesh>
              <mesh ref={steam1Ref} position={[-0.015, 0.12, 0]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
              </mesh>
              <mesh ref={steam2Ref} position={[0.02, 0.18, 0]}>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
              </mesh>
            </group>
          )}
        </group>

        {/* Mini Hologram Tablet / Screen when Working */}
        {showHologram && (
          <group ref={holoRef} position={[0, 0.62, 0.42]}>
            <RoundedBox args={[0.38, 0.24, 0.02]} radius={0.01} rotation={[-0.25, 0, 0]}>
              <meshStandardMaterial
                color={meta.neon}
                emissive={meta.neon}
                emissiveIntensity={1.1}
                transparent
                opacity={0.85}
              />
            </RoundedBox>
          </group>
        )}

        {/* BIG ADORABLE CHIBI HEAD */}
        <group ref={headRef} position={[0, 1.04, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.34, 24, 24]} />
            <meshStandardMaterial color="#ffe5d8" roughness={0.45} />
          </mesh>

          <ChibiHair style={hairStyle} color={hairColor} />

          {/* Big Blinking Anime Eyes with Sparkles */}
          <group ref={leftEyeRef} position={[-0.12, -0.02, 0.31]}>
            <mesh>
              <sphereGeometry args={[0.058, 14, 14]} />
              <meshStandardMaterial color="#0f172a" roughness={0.1} />
            </mesh>
            <mesh position={[0.02, 0.022, 0.048]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.012, -0.018, 0.05]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshBasicMaterial color={meta.neon} />
            </mesh>
          </group>
          <group ref={rightEyeRef} position={[0.12, -0.02, 0.31]}>
            <mesh>
              <sphereGeometry args={[0.058, 14, 14]} />
              <meshStandardMaterial color="#0f172a" roughness={0.1} />
            </mesh>
            <mesh position={[0.02, 0.022, 0.048]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.012, -0.018, 0.05]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshBasicMaterial color={meta.neon} />
            </mesh>
          </group>

          {/* Rosy Kawaii Blush */}
          <mesh position={[-0.2, -0.09, 0.275]} rotation={[0, -0.35, 0]}>
            <circleGeometry args={[0.052, 14]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.2, -0.09, 0.275]} rotation={[0, 0.35, 0]}>
            <circleGeometry args={[0.052, 14]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.7} />
          </mesh>

          {/* Happy Cat Smile */}
          <mesh position={[0, -0.11, 0.325]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.032, 0.01, 8, 16, Math.PI]} />
            <meshBasicMaterial color="#be123c" />
          </mesh>

          {/* Cat-Ear Headphones */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.365, 0.026, 10, 28, Math.PI]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.3} roughness={0.3} />
          </mesh>
          <mesh position={[-0.36, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.095, 0.095, 0.07, 16]} />
            <meshStandardMaterial color={outfitColor} />
          </mesh>
          <mesh position={[0.36, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.095, 0.095, 0.07, 16]} />
            <meshStandardMaterial color={outfitColor} />
          </mesh>
          <mesh position={[-0.22, 0.36, 0]} rotation={[0, 0, 0.35]} castShadow>
            <coneGeometry args={[0.088, 0.16, 4]} />
            <meshStandardMaterial color={meta.neon} emissive={meta.neon} emissiveIntensity={0.85} />
          </mesh>
          <mesh position={[0.22, 0.36, 0]} rotation={[0, 0, -0.35]} castShadow>
            <coneGeometry args={[0.088, 0.16, 4]} />
            <meshStandardMaterial color={meta.neon} emissive={meta.neon} emissiveIntensity={0.85} />
          </mesh>
        </group>

        {/* ================= COMIC-BOOK SPEECH BUBBLE REPORT ================= */}
        <Html position={[0, 1.98, 0]} center distanceFactor={14.5} zIndexRange={[20, 0]}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
              width: '232px',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                background: '#fffef9',
                color: '#0f172a',
                border: '2.5px solid #0f172a',
                borderRadius: '16px',
                padding: '7px 10px',
                boxShadow: '4px 4px 0px #0f172a',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  borderBottom: '1.5px dashed #cbd5e1',
                  paddingBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '11px',
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.agentName}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    background: meta.bg,
                    border: `1.5px solid ${meta.color}`,
                    color: meta.color,
                    fontSize: '9.5px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={10} color={meta.color} />
                  {meta.label}
                </span>
              </div>

              <div
                style={{
                  fontSize: '10.5px',
                  lineHeight: 1.35,
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                “{agent.reportText || 'Đang trực tại văn phòng sẵn sàng nhận việc!'}”
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '1px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    fontWeight: 800,
                    color: '#475569',
                  }}
                >
                  <span>{agent.stageLabel || meta.dept}</span>
                  <span style={{ color: meta.color }}>{agent.progress ?? 70}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    background: '#e2e8f0',
                    borderRadius: '999px',
                    border: '1px solid #0f172a',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${agent.progress ?? 70}%`,
                      height: '100%',
                      background: meta.color,
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '-11px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '9px solid transparent',
                  borderRight: '9px solid transparent',
                  borderTop: '11px solid #0f172a',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: '9px solid #fffef9',
                }}
              />
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}

export default function App() {
  const [liveAgents, setLiveAgents] = useState([]);
  const [ambientAgents, setAmbientAgents] = useState(AMBIENT_INITIAL);
  const [showAmbient, setShowAmbient] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [simCounter, setSimCounter] = useState(1);

  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket(SERVER_WS);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'agents_update' && Array.isArray(data.agents)) {
            setLiveAgents(data.agents);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Autonomous office life loop: ambient chibi staff walk between floors, sit at desks, inspect globe & drink tea
  useEffect(() => {
    if (!showAmbient) return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      setAmbientAgents((prev) =>
        prev.map((a, idx) => {
          // Rotate one agent at a time every 6s so they move smoothly & naturally
          if (tick % prev.length !== idx) return a;
          const next = AMBIENT_SCRIPT[(tick + idx) % AMBIENT_SCRIPT.length];
          return {
            ...a,
            status: next.status,
            department: STATUS_META[next.status].dept,
            reportText: next.reportText,
            stageLabel: next.stageLabel,
            progress: next.progress,
          };
        })
      );
    }, 6500);

    return () => clearInterval(timer);
  }, [showAmbient]);

  const displayedAgents = useMemo(() => {
    return showAmbient ? [...ambientAgents, ...liveAgents] : liveAgents;
  }, [ambientAgents, liveAgents, showAmbient]);

  async function sendSimulatedHook(payload) {
    try {
      await fetch(`${SERVER_HTTP}/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setLiveAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === payload.agentId);
        const statusMap = {
          SubagentStart: 'Entering',
          SubagentStop: 'Leaving',
          IdleNow: 'Idle',
        };
        const status = statusMap[payload.event] || 'Write';
        const next = {
          agentId: payload.agentId,
          agentName: payload.agentName,
          status,
          department: STATUS_META[status]?.dept || STATUS_META.Idle.dept,
          toolName: payload.toolName || '',
          reportText:
            payload.reportText || `Đang thực hiện ${payload.toolName || payload.event}...`,
          progress: 75,
          stageLabel: 'Đang xử lý',
          color: '#38bdf8',
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        }
        return [...prev, next];
      });
    }
  }

  function handleSpawnTestAgent() {
    const id = `sim-agent-${simCounter}`;
    const name = `Trợ Lý AI #${simCounter}`;
    setSimCounter((c) => c + 1);

    sendSimulatedHook({
      agentId: id,
      agentName: name,
      event: 'SubagentStart',
      toolName: '',
    });

    setTimeout(() => {
      sendSimulatedHook({
        agentId: id,
        agentName: name,
        event: 'PreToolUse',
        toolName: 'read_file',
        detail: 'src/App.jsx',
      });
    }, 2200);

    setTimeout(() => {
      sendSimulatedHook({
        agentId: id,
        agentName: name,
        event: 'PreToolUse',
        toolName: 'replace_file_content',
        detail: 'src/App.jsx',
      });
    }, 6500);
  }

  const latestLiveAgent = liveAgents[liveAgents.length - 1];

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0e1a24' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.5, 8.2, 16.5], fov: 38, near: 0.1, far: 120 }}
      >
        <color attach="background" args={['#0e1a24']} />
        <fog attach="fog" args={['#0e1a24', 28, 55]} />

        <ambientLight intensity={0.62} color="#dbeafe" />
        <hemisphereLight args={['#fff7ed', '#0f172a', 0.6]} />
        <directionalLight
          position={[8, 18, 10]}
          intensity={1.25}
          color="#fffbeb"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />

        <OfficeEnvironment />

        <ContactShadows position={[0, 0.03, 0]} opacity={0.38} scale={22} blur={2.4} far={6} />

        {displayedAgents.map((agent, index) => (
          <ChibiAgent key={agent.agentId} agent={agent} slotIndex={index} />
        ))}

        <OrbitControls
          enableDamping
          dampingFactor={0.07}
          maxPolarAngle={Math.PI / 2.05}
          minPolarAngle={Math.PI / 10}
          minDistance={7}
          maxDistance={30}
          target={[0, 2.0, -0.5]}
        />
      </Canvas>

      {/* Corner Control Panel HUD */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          width: 315,
          padding: '14px 16px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.86)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={19} color="#38bdf8" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>
                VHN • Văn Phòng AI 2 Tầng
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                Hoạt ảnh Chibi & Báo cáo thời gian thực
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              color: wsConnected ? '#4ade80' : '#f87171',
            }}
          >
            {wsConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{wsConnected ? 'Trực Tuyến' : 'Offline'}</span>
          </div>
        </div>

        <button
          onClick={handleSpawnTestAgent}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          }}
        >
          <Plus size={15} />
          Test Spawn Sub-agent (Thêm Nhân Sự)
        </button>

        <button
          onClick={() => setShowAmbient((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: showAmbient ? 'rgba(56, 189, 248, 0.14)' : 'rgba(30, 41, 59, 0.6)',
            color: showAmbient ? '#7dd3fc' : '#94a3b8',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} />
            Nhân viên Chibi tự vận hành
          </span>
          <span>{showAmbient ? 'Đang Bật' : 'Đang Tắt'}</span>
        </button>

        {latestLiveAgent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>
              Điều phối nhanh ({latestLiveAgent.agentName}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[
                {
                  label: 'Lên Tầng 2 Đọc',
                  tool: 'read_file',
                  detail: 'src/App.jsx',
                  event: 'PreToolUse',
                  color: '#fbbf24',
                },
                {
                  label: 'Xuống Tầng 1 Code',
                  tool: 'write_to_file',
                  detail: 'server.js',
                  event: 'PreToolUse',
                  color: '#4ade80',
                },
                {
                  label: 'Ra Quả Địa Cầu',
                  tool: 'browser_subagent',
                  detail: 'localhost:5173',
                  event: 'PreToolUse',
                  color: '#38bdf8',
                },
                {
                  label: 'Ngồi Bàn Chờ',
                  tool: 'AskUserQuestion',
                  detail: 'Duyệt giao diện',
                  event: 'PreToolUse',
                  color: '#fb7185',
                },
                {
                  label: 'Ngồi Sofa Uống Trà',
                  tool: '',
                  detail: '',
                  event: 'IdleNow',
                  reportText: 'Đã làm xong task! Đang ngồi sofa thưởng thức tách trà nóng 🍵',
                  color: '#2dd4bf',
                },
                {
                  label: 'Tan Ca',
                  tool: '',
                  detail: '',
                  event: 'SubagentStop',
                  color: '#94a3b8',
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() =>
                    sendSimulatedHook({
                      agentId: latestLiveAgent.agentId,
                      agentName: latestLiveAgent.agentName,
                      event: btn.event,
                      toolName: btn.tool,
                      detail: btn.detail,
                      reportText: btn.reportText,
                    })
                  }
                  style={{
                    flex: '1 1 46%',
                    padding: '5px 7px',
                    borderRadius: '7px',
                    border: `1px solid ${btn.color}55`,
                    background: 'rgba(30, 41, 59, 0.9)',
                    color: btn.color,
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            paddingTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '185px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              color: '#cbd5e1',
              fontWeight: 700,
            }}
          >
            <Sparkles size={12} color="#fbbf24" />
            <span>Nhân sự trong văn phòng ({displayedAgents.length})</span>
          </div>
          {displayedAgents.map((a) => {
            const meta = STATUS_META[a.status] || STATUS_META.Idle;
            return (
              <div
                key={a.agentId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.68)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 700 }}>{a.agentName}</span>
                  <span
                    style={{
                      color: meta.neon,
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: `1px solid ${meta.neon}66`,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      fontWeight: 700,
                      fontSize: '9.5px',
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                  📍 {a.department || meta.dept}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
