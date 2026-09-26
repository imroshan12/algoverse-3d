import { Billboard, Grid, Html, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Callout, EdgeState, Marker, NodeState, Run, VEdge, VNode, Vec3 } from "../algorithms/types";
import { BASE_MS } from "../usePlayer";
import { buildTrays, computeLayout, DEFAULT_BOX, TRAY_GAP, type RunLayout } from "./layout";
import { usePresence } from "./usePresence";

export const NODE_COLORS: Record<NodeState, string> = {
  idle: "#7aa2ff",
  pending: "#ffb627",
  current: "#ff4f9a",
  visited: "#22c98a",
  found: "#8b5cf6",
  removing: "#ff4d4d",
  ghost: "#b8c4dc",
};

const EDGE_COLORS: Record<EdgeState, string> = {
  idle: "#aab6cc",
  active: "#ff4f9a",
  tree: "#22c98a",
};

const SPHERE_R = 0.42;
const UP = new THREE.Vector3(0, 1, 0);
const damp = THREE.MathUtils.damp;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

type Registry = Map<string, THREE.Object3D>;

/** Seconds each step's motion should take: shorter when playback runs faster. */
const Anim = createContext({ dur: 0.5 });

// ---------------------------------------------------------------------------
// Motion along arcs: moving elements swing out of the plane so swaps never pass through each other.
// ---------------------------------------------------------------------------

interface Motion {
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  to: THREE.Vector3;
  pos: THREE.Vector3;
  t: number;
  dur: number;
}

function retarget(m: Motion, to: THREE.Vector3, dur: number, arc: boolean) {
  if (m.to.distanceToSquared(to) < 1e-10) return;
  m.from.copy(m.pos);
  m.to.copy(to);
  m.t = 0;
  m.dur = Math.max(dur, 0.05);
  const d = to.clone().sub(m.from);
  const len = d.length();
  m.ctrl.copy(m.from).lerp(to, 0.5);
  if (arc && len > 0.35) {
    // Moving right swings towards the camera, moving left swings away: two swapped items pass cleanly.
    const side = Math.abs(d.x) >= Math.abs(d.y) ? Math.sign(d.x) || 1 : Math.sign(d.y) || 1;
    m.ctrl.z += side * Math.min(0.42 * len, 1.5);
    m.ctrl.y += Math.min(0.15 * len, 0.6);
  }
}

function newMotion(start: Vec3, target: Vec3, dur: number): Motion {
  const s = v3(start);
  const m: Motion = { from: s.clone(), ctrl: s.clone(), to: s.clone(), pos: s.clone(), t: 1, dur };
  retarget(m, v3(target), dur, true);
  return m;
}

function stepMotion(m: Motion, dt: number) {
  if (m.t >= 1) {
    m.pos.copy(m.to);
    return;
  }
  m.t = Math.min(1, m.t + dt / m.dur);
  const e = easeInOut(m.t);
  const u = 1 - e;
  m.pos.set(
    u * u * m.from.x + 2 * u * e * m.ctrl.x + e * e * m.to.x,
    u * u * m.from.y + 2 * u * e * m.ctrl.y + e * e * m.to.y,
    u * u * m.from.z + 2 * u * e * m.ctrl.z + e * e * m.to.z,
  );
}

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grd.addColorStop(0.65, "rgba(255,255,255,0.16)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Sphere radius: `size[0]` is the diameter when given. */
const radiusOf = (n: VNode) => (n.size ? n.size[0] / 2 : SPHERE_R);

/** How far from its centre an edge should stop so arrows touch the surface. */
const reach = (n: VNode) => (n.shape === "box" ? Math.min((n.size ?? DEFAULT_BOX)[0], (n.size ?? DEFAULT_BOX)[1]) / 2 + 0.05 : radiusOf(n) + 0.04);

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function NodeMesh({ node, leaving, spawnFrom, registry, onPick }: { node: VNode; leaving: boolean; spawnFrom?: Vec3; registry: Registry; onPick?: (id: string) => void }) {
  const { dur } = useContext(Anim);
  const box = node.shape === "box";
  const size = node.size ?? DEFAULT_BOX;
  const r = radiusOf(node);
  const ghost = node.state === "ghost";
  const emphasised = node.state === "current" || node.state === "found" || node.state === "removing";
  const involved = node.state !== "idle" && node.state !== "ghost";

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.Sprite>(null);
  const target = useMemo(() => new THREE.Color(), []);
  target.set(NODE_COLORS[node.state]);
  const motion = useRef<Motion | null>(null);
  motion.current ??= newMotion(spawnFrom ?? node.pos, node.pos, dur);
  const anim = useRef({ scale: 0, glow: 0, sx: size[0], sy: size[1], sz: size[2], opacity: ghost ? 0.28 : 1 });

  const [px, py, pz] = node.pos;
  const arcRef = useRef(involved);
  arcRef.current = involved;
  useEffect(() => {
    retarget(motion.current!, new THREE.Vector3(px, py, pz), dur, arcRef.current);
    // dur is read at the moment the target changes on purpose.
  }, [px, py, pz]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const m = motion.current!;
    stepMotion(m, dt);
    g.position.copy(m.pos);
    const a = anim.current;
    const want = leaving ? 0 : node.state === "current" && !box ? 1.16 : node.state === "removing" ? 0.94 : 1;
    a.scale = damp(a.scale, want, leaving ? 16 : 11, dt);
    g.scale.setScalar(Math.max(a.scale, 1e-4));
    if (box && body.current) {
      a.sx = damp(a.sx, size[0], 10, dt);
      a.sy = damp(a.sy, size[1], 10, dt);
      a.sz = damp(a.sz, size[2], 10, dt);
      body.current.scale.set(a.sx, a.sy, a.sz);
    }
    const k = 1 - Math.exp(-dt * 9);
    if (mat.current) {
      mat.current.color.lerp(target, k);
      mat.current.emissive.copy(mat.current.color);
      a.opacity = damp(a.opacity, ghost ? 0.28 : 1, 9, dt);
      mat.current.opacity = a.opacity;
      mat.current.depthWrite = a.opacity > 0.95;
      mat.current.emissiveIntensity = ghost ? 0.05 : emphasised ? 0.45 : 0.25;
    }
    a.glow = damp(a.glow, leaving ? 0 : emphasised ? 1 : involved ? 0.4 : 0, 8, dt);
    const pulse = node.state === "current" ? 1 + 0.09 * Math.sin(state.clock.elapsedTime * 5.5) : 1;
    const c = mat.current ? mat.current.color : target;
    if (glow.current) {
      glow.current.scale.setScalar(2.4 * (r / SPHERE_R) * pulse);
      const sm = glow.current.material;
      sm.opacity = a.glow * 0.75;
      sm.color.copy(c);
    }
    if (halo.current && haloMat.current) {
      const pad = 0.26 * pulse;
      halo.current.scale.set(a.sx + pad, a.sy + pad, a.sz + pad);
      haloMat.current.opacity = a.glow * 0.24;
      haloMat.current.color.copy(c);
    }
  });

  const fontSize = box ? Math.min(0.34, size[0] * 0.42, (size[0] * 1.9) / Math.max(node.label.length, 1)) : Math.min(node.label.length > 3 ? 0.26 : 0.34, r * 0.8);
  return (
    <group
      ref={(g) => {
        group.current = g;
        if (!g) return;
        g.userData.reach = reach(node);
        g.position.copy(motion.current!.pos);
        registry.set(node.id, g);
        return () => {
          if (registry.get(node.id) === g) registry.delete(node.id);
        };
      }}
    >
      <mesh
        ref={body}
        onClick={(e) => {
          if (!onPick || ghost || e.delta > 4) return;
          e.stopPropagation();
          onPick(node.id);
        }}
        onPointerOver={() => onPick && !ghost && (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {box ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[r, 48, 48]} />}
        <meshPhysicalMaterial ref={mat} color={NODE_COLORS[node.state]} transparent roughness={box ? 0.4 : 0.28} metalness={0.05} clearcoat={0.6} clearcoatRoughness={0.25} />
      </mesh>
      {box ? (
        <mesh ref={halo}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial ref={haloMat} transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : (
        <sprite ref={glow}>
          <spriteMaterial map={glowTexture()} transparent opacity={0} depthWrite={false} />
        </sprite>
      )}
      {node.label && (
        <Billboard position={node.labelAbove ? [0, size[1] / 2 + 0.32, 0] : [0, 0, 0]}>
          <Text
            position={[0, 0, node.labelAbove ? 0.2 : (box ? size[2] / 2 : r) + 0.07]}
            fontSize={fontSize}
            color={ghost ? "#5b6886" : "#0b1530"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#ffffff"
            fontWeight={700}
          >
            {node.label}
          </Text>
        </Billboard>
      )}
      {node.sub && (
        <Billboard position={[0, -(box ? size[1] / 2 : r) - 0.34, 0]}>
          <Text position={[0, 0, 0.3]} fontSize={0.24} color="#33415c" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#ffffff">
            {node.sub}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Edges: a thin base tube, plus a highlight that flows out of the exploring node with a glowing bead.
// ---------------------------------------------------------------------------

function placeRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const d = b.clone().sub(a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  mesh.scale.set(Math.max(r, 1e-4), Math.max(len, 1e-4), Math.max(r, 1e-4));
}

function useEdgeState(edge: VEdge, leaving: boolean) {
  const lit = edge.state !== "idle" && !leaving;
  const s = useRef({ fill: 0, appear: 0, src: edge.flowFrom ?? edge.from, wasLit: false, color: new THREE.Color(EDGE_COLORS[edge.state === "idle" ? "active" : edge.state]) });
  const litColor = EDGE_COLORS[edge.state === "idle" ? "active" : edge.state];
  return { s, lit, litColor };
}

const tmpColor = new THREE.Color();
const IDLE_EDGE = new THREE.Color(EDGE_COLORS.idle);

function EdgeMesh({ edge, leaving, registry }: { edge: VEdge; leaving: boolean; registry: Registry }) {
  const { dur } = useContext(Anim);
  const base = useRef<THREE.Mesh>(null);
  const over = useRef<THREE.Mesh>(null);
  const overMat = useRef<THREE.MeshStandardMaterial>(null);
  const bead = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  const coneMat = useRef<THREE.MeshStandardMaterial>(null);
  const label = useRef<THREE.Group>(null);
  const { s, lit, litColor } = useEdgeState(edge, leaving);
  const v = useMemo(() => ({ dir: new THREE.Vector3(), p0: new THREE.Vector3(), p1: new THREE.Vector3(), q: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    const A = registry.get(edge.from);
    const B = registry.get(edge.to);
    if (!A || !B || !base.current || !over.current) return;
    const st = s.current;
    if (lit && !st.wasLit) st.src = edge.flowFrom ?? edge.from;
    st.wasLit = lit;
    st.appear = damp(st.appear, leaving ? 0 : 1, 12, dt);
    st.fill = lit ? Math.min(1, st.fill + dt / dur) : Math.max(0, st.fill - dt / (dur * 0.8));
    st.color.lerp(tmpColor.set(litColor), 1 - Math.exp(-dt * 10));

    const { dir, p0, p1, q } = v;
    dir.subVectors(B.position, A.position);
    const full = dir.length();
    if (full < 1e-3) return;
    dir.divideScalar(full);
    p0.copy(A.position).addScaledVector(dir, edge.directed ? (A.userData.reach ?? 0.45) : 0);
    p1.copy(B.position).addScaledVector(dir, edge.directed ? -((B.userData.reach ?? 0.45) + 0.24) : 0);
    placeRod(base.current, p0, p1, 0.042 * st.appear);

    const f = easeOut(st.fill);
    over.current.visible = f > 0.002;
    if (over.current.visible) {
      const fromB = st.src === edge.to;
      const s0 = fromB ? p1 : p0;
      const s1 = fromB ? p0 : p1;
      q.copy(s0).lerp(s1, f);
      placeRod(over.current, s0, q, 0.08 * st.appear);
      overMat.current?.color.copy(st.color);
      overMat.current?.emissive.copy(st.color);
      if (bead.current) {
        bead.current.visible = lit && st.fill < 0.999;
        bead.current.position.copy(q);
      }
    } else if (bead.current) bead.current.visible = false;
    if (cone.current && coneMat.current) {
      cone.current.position.copy(p1).addScaledVector(dir, 0.12);
      cone.current.quaternion.setFromUnitVectors(UP, dir);
      cone.current.scale.setScalar(Math.max(st.appear, 1e-4));
      coneMat.current.color.copy(f > 0.95 ? st.color : IDLE_EDGE);
    }
    if (label.current) {
      label.current.position.copy(A.position).lerp(B.position, 0.5);
      label.current.scale.setScalar(Math.max(st.appear, 1e-4));
    }
  });

  return (
    <>
      <mesh ref={base}>
        <cylinderGeometry args={[1, 1, 1, 14]} />
        <meshStandardMaterial color={EDGE_COLORS.idle} roughness={0.5} />
      </mesh>
      <mesh ref={over} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 14]} />
        <meshStandardMaterial ref={overMat} emissiveIntensity={0.45} roughness={0.35} />
      </mesh>
      <mesh ref={bead} visible={false}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color="#fff6c2" />
      </mesh>
      {edge.directed && (
        <mesh ref={cone}>
          <coneGeometry args={[0.13, 0.28, 20]} />
          <meshStandardMaterial ref={coneMat} color={EDGE_COLORS.idle} />
        </mesh>
      )}
      {edge.label !== undefined && (
        <group ref={label}>
          <Billboard>
            <Text position={[0, 0.02, 0.3]} fontSize={0.3} color="#1d2a44" outlineWidth={0.045} outlineColor="#ffffff" fontWeight={700}>
              {edge.label}
            </Text>
          </Billboard>
        </group>
      )}
    </>
  );
}

/** A bowed arrow (used for "this cell depends on that cell" in DP tables). Its geometry is rebuilt as it grows. */
function CurvedEdge({ edge, leaving, registry }: { edge: VEdge; leaving: boolean; registry: Registry }) {
  const { dur } = useContext(Anim);
  const tube = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  const { s, lit, litColor } = useEdgeState(edge, leaving);
  const last = useRef("");
  const color = useMemo(() => new THREE.Color(litColor), [litColor]);

  useEffect(
    () => () => {
      tube.current?.geometry.dispose();
    },
    [],
  );

  useFrame((_, dt) => {
    const A = registry.get(edge.from);
    const B = registry.get(edge.to);
    if (!A || !B || !tube.current || !cone.current) return;
    const st = s.current;
    st.fill = lit ? Math.min(1, st.fill + dt / dur) : Math.max(0, st.fill - dt / (dur * 0.8));
    const bend = edge.bend ?? 0.6;
    const ctrl = A.position.clone().lerp(B.position, 0.5).add(new THREE.Vector3(0, bend * 0.35, bend));
    const p0 = A.position.clone().add(ctrl.clone().sub(A.position).normalize().multiplyScalar(A.userData.reach ?? 0.45));
    const p1 = B.position.clone().add(ctrl.clone().sub(B.position).normalize().multiplyScalar((B.userData.reach ?? 0.45) + 0.2));
    const f = easeOut(st.fill);
    const key = `${f.toFixed(3)}|${p0.toArray().map((x) => x.toFixed(3))}|${p1.toArray().map((x) => x.toFixed(3))}`;
    tube.current.visible = f > 0.01;
    cone.current.visible = f > 0.9;
    if (key !== last.current && f > 0.01) {
      last.current = key;
      // de Casteljau: the first f of a quadratic Bézier is itself a quadratic Bézier.
      const m1 = p0.clone().lerp(ctrl, f);
      const m2 = ctrl.clone().lerp(p1, f);
      const end = m1.clone().lerp(m2, f);
      const geom = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, m1, end), 20, 0.05, 8, false);
      tube.current.geometry.dispose();
      tube.current.geometry = geom;
      cone.current.position.copy(p1).add(p1.clone().sub(ctrl).normalize().multiplyScalar(0.1));
      cone.current.quaternion.setFromUnitVectors(UP, p1.clone().sub(ctrl).normalize());
    }
  });

  return (
    <>
      <mesh ref={tube} visible={false}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
      <mesh ref={cone} visible={false}>
        <coneGeometry args={[0.11, 0.24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pointer labels, speech bubbles, tray plates
// ---------------------------------------------------------------------------

function MarkerView({ marker, leaving }: { marker: Marker; leaving: boolean }) {
  const { dur } = useContext(Anim);
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion | null>(null);
  motion.current ??= newMotion(marker.pos, marker.pos, dur);
  const scale = useRef(0);
  const [x, y, z] = marker.pos;
  useEffect(() => {
    retarget(motion.current!, new THREE.Vector3(x, y, z), dur, false);
  }, [x, y, z]);
  useFrame((_, dt) => {
    if (!group.current) return;
    stepMotion(motion.current!, dt);
    group.current.position.copy(motion.current!.pos);
    scale.current = damp(scale.current, leaving ? 0 : 1, 12, dt);
    group.current.scale.setScalar(Math.max(scale.current, 1e-4));
  });
  const color = marker.color ?? "#4f6bff";
  const fs = marker.size ?? 0.3;
  const halfWidth = marker.text.length * 0.085 + 0.12;
  const arrow =
    marker.arrow === "up" ? { pos: [0, 0.34, 0] as Vec3, rot: [0, 0, 0] as Vec3 } :
    marker.arrow === "down" ? { pos: [0, -0.34, 0] as Vec3, rot: [0, 0, Math.PI] as Vec3 } :
    marker.arrow === "left" ? { pos: [-halfWidth - 0.12, 0, 0] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 } : null;
  return (
    <group ref={group}>
      <Billboard>
        <Text fontSize={fs} color={color} anchorX={marker.align ?? "center"} anchorY="middle" outlineWidth={0.035} outlineColor="#ffffff" fontWeight={700}>
          {marker.text}
        </Text>
        {arrow && (
          <mesh position={arrow.pos} rotation={arrow.rot}>
            <coneGeometry args={[0.1, 0.22, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )}
      </Billboard>
    </group>
  );
}

function CalloutView({ callout, registry, nodes }: { callout: Callout; registry: Registry; nodes: Map<string, VNode> }) {
  const ids = Array.isArray(callout.at) ? callout.at : [callout.at];
  const lift = Math.max(
    ...ids.map((id) => {
      const n = nodes.get(id);
      if (!n) return 0.8;
      if (n.shape === "box") return (n.size ?? DEFAULT_BOX)[1] / 2 + (n.labelAbove ? 0.72 : 0.3);
      return radiusOf(n) + 0.28;
    }),
  );
  const start = useMemo(() => {
    const ps = ids.map((id) => nodes.get(id)?.pos).filter((p): p is Vec3 => !!p);
    if (!ps.length) return new THREE.Vector3();
    const y = callout.below ? Math.min(...ps.map((p) => p[1])) - lift : Math.max(...ps.map((p) => p[1])) + lift;
    return new THREE.Vector3(ps.reduce((s, p) => s + p[0], 0) / ps.length, y, ps.reduce((s, p) => s + p[2], 0) / ps.length);
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    let x = 0;
    let z = 0;
    let y = callout.below ? Infinity : -Infinity;
    let c = 0;
    for (const id of ids) {
      const o = registry.get(id);
      if (!o) continue;
      x += o.position.x;
      z += o.position.z;
      y = callout.below ? Math.min(y, o.position.y) : Math.max(y, o.position.y);
      c++;
    }
    if (c && group.current) group.current.position.set(x / c, callout.below ? y - lift : y + lift, z / c);
  });
  return (
    <group ref={group} position={start}>
      <Html center zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
        <div className={`callout ${callout.tone ?? "info"}${callout.below ? " below" : ""}`}>{callout.text}</div>
      </Html>
    </group>
  );
}

function TrayPlates({ layout }: { layout: RunLayout }) {
  return (
    <>
      {layout.trays.map((r) => {
        const w = r.slots * TRAY_GAP + 0.16;
        return (
          <mesh key={r.label} position={[r.x0 + ((r.slots - 1) * TRAY_GAP) / 2, r.y, -0.3]}>
            <boxGeometry args={[w, 0.74, 0.08]} />
            <meshStandardMaterial color="#dde4f2" roughness={0.9} />
          </mesh>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera: one fixed, tidy view per run (it only moves when a new run starts).
// ---------------------------------------------------------------------------

function CameraRig({ layout, free }: { layout: RunLayout; free: boolean }) {
  const { camera, size } = useThree();
  const target = useMemo(() => {
    const b = layout.view.clone();
    const h = b.max.y - b.min.y;
    b.max.y += h * 0.14 + 0.9; // headroom for the title and legend overlays
    b.min.y -= 0.3;
    b.min.x -= 0.5;
    b.max.x += 0.5;
    const center = b.getCenter(new THREE.Vector3());
    const sz = b.getSize(new THREE.Vector3());
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const fitH = sz.y / 2 / Math.tan(fov / 2);
    const fitW = sz.x / 2 / Math.tan(fov / 2) / aspect;
    return { center, dist: Math.max(7, fitH, fitW) + sz.z / 2 + 0.6 };
  }, [layout, camera, size]);

  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  useFrame((_, dt) => {
    if (free) return;
    const k = 1 - Math.exp(-dt * 3.2);
    desired.set(target.center.x, target.center.y + target.dist * 0.2, target.center.z + target.dist);
    camera.position.lerp(desired, k);
    look.current.lerp(target.center, k);
    camera.lookAt(look.current);
  });

  return free ? <OrbitControls makeDefault target={target.center} enableDamping /> : null;
}

// ---------------------------------------------------------------------------

const keyNode = (n: VNode) => n.id;
const keyEdge = (e: VEdge) => e.id;
const keyMarker = (m: Marker) => m.id;

export function Scene({ run, index, speed, freeCam, hideCallouts, onPick }: { run: Run; index: number; speed: number; freeCam: boolean; hideCallouts?: boolean; onPick?: (id: string) => void }) {
  const frame = run.frames[Math.min(index, run.frames.length - 1)];
  const layout = useMemo(() => computeLayout(run), [run]);
  const trays = useMemo(() => buildTrays(frame, layout), [frame, layout]);
  const nodes = useMemo(() => [...frame.nodes, ...trays.nodes], [frame, trays]);
  const markers = useMemo(() => [...(frame.markers ?? []), ...trays.markers], [frame, trays]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const dur = Math.min(0.7, Math.max(0.16, ((BASE_MS / speed) / 1000) * 0.6));
  const exitMs = Math.round(dur * 1000) + 150;
  const nodeP = usePresence(nodes, keyNode, exitMs);
  const edgeP = usePresence(frame.edges, keyEdge, exitMs);
  const markerP = usePresence(markers, keyMarker, exitMs);
  const registry = useMemo<Registry>(() => new Map(), []);
  const anim = useMemo(() => ({ dur }), [dur]);
  const floorX = (layout.view.min.x + layout.view.max.x) / 2;

  return (
    <Canvas camera={{ position: [0, 2, 14], fov: 42 }} dpr={[1, 2]}>
      <Anim.Provider value={anim}>
        <color attach="background" args={["#eef2fa"]} />
        <hemisphereLight args={["#ffffff", "#c9d4ee", 0.9]} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[6, 10, 12]} intensity={1.35} />
        <directionalLight position={[-8, -4, 6]} intensity={0.35} />
        <Grid position={[floorX, layout.floorY, 0]} args={[80, 80]} cellSize={0.5} cellThickness={0.6} cellColor="#d7deec" sectionSize={2.5} sectionThickness={1} sectionColor="#c3cde2" fadeDistance={42} fadeStrength={2.2} infiniteGrid />
        <TrayPlates layout={layout} />
        {edgeP.map(({ item, leaving }) =>
          item.bend ? <CurvedEdge key={item.id} edge={item} leaving={leaving} registry={registry} /> : <EdgeMesh key={item.id} edge={item} leaving={leaving} registry={registry} />,
        )}
        {nodeP.map(({ item, leaving }) => (
          <NodeMesh key={item.id} node={item} leaving={leaving} spawnFrom={trays.spawn.get(item.id) ?? item.from} registry={registry} onPick={item.id.startsWith("tray|") ? undefined : onPick} />
        ))}
        {markerP.map(({ item, leaving }) => (
          <MarkerView key={item.id} marker={item} leaving={leaving} />
        ))}
        {(hideCallouts ? [] : (frame.callouts ?? [])).map((c) => (
          <CalloutView key={`${Array.isArray(c.at) ? c.at.join(",") : c.at}|${c.text}`} callout={c} registry={registry} nodes={nodeMap} />
        ))}
        <CameraRig layout={layout} free={freeCam} />
      </Anim.Provider>
    </Canvas>
  );
}
