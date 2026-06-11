"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Float32BufferAttribute,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { prefersReducedMotion } from "./motion-primitives";

const BG_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BG_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.55;
  }
  return v;
}
// A theatre spotlight: a cone of light falling from the origin at an angle.
float beam(vec2 p, vec2 origin, float angle, float width, float t) {
  vec2 d = p - origin;
  float c = cos(angle);
  float s = sin(angle);
  vec2 r = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float spread = 0.35 + abs(r.y) * 0.85;
  float core = smoothstep(width, 0.0, abs(r.x) / spread);
  float reach = smoothstep(0.15, -0.2, r.y) * exp(r.y * 0.5);
  float haze = 0.72 + 0.28 * noise(r * 3.0 + vec2(0.0, t * 0.6));
  return core * reach * haze;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect;
  float t = uTime;

  // smoke drifting through the dark
  float n = fbm(vec2(p.x * 0.9, p.y * 0.7) + vec2(t * 0.05, -t * 0.03));
  float n2 = fbm(vec2(p.x * 1.7 - t * 0.045, p.y * 1.2 + t * 0.06));
  vec3 crimson = vec3(0.93, 0.13, 0.30);
  vec3 amber = vec3(1.0, 0.62, 0.18);
  vec3 violet = vec3(0.42, 0.20, 0.85);
  vec3 smoke = mix(crimson, violet, smoothstep(0.30, 0.80, n));
  smoke = mix(smoke, amber, smoothstep(0.55, 0.95, n2) * 0.6);
  float density = smoothstep(0.35, 1.0, n * 0.7 + n2 * 0.5) * 0.5;

  // sweeping spotlights
  float sway = sin(t * 0.22) * 0.28;
  float b1 = beam(p, vec2(-0.9 + sway, 1.25), 0.45 + sway * 0.30, 0.16, t);
  float b2 = beam(p, vec2(0.95 - sway, 1.30), -0.50 + sway * 0.25, 0.20, t);
  float b3 = beam(p, vec2(0.08, 1.40), sway * 0.5, 0.11, t);
  vec3 warm = vec3(1.0, 0.72, 0.42);
  vec3 pink = vec3(1.0, 0.30, 0.45);

  vec3 col = vec3(0.012, 0.012, 0.016);
  col += smoke * density * 0.62;
  col += warm * b1 * 0.40 + pink * b2 * 0.34 + warm * b3 * 0.28;

  // vignette and a faint footlight at the bottom of the frame
  vec2 q = p * vec2(0.55, 0.70);
  col *= clamp(1.0 - dot(q, q), 0.0, 1.0);
  col += pink * smoothstep(1.6, 0.0, abs(p.y + 1.05)) * 0.05;

  // dither to kill banding
  col += (hash(p * 1234.5 + t) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

const THUMB_HUES = [348, 28, 268, 205, 152, 318, 42, 222];

function makeThumbTexture(hue: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const bg = ctx.createLinearGradient(0, 0, 256, 144);
    bg.addColorStop(0, `hsl(${hue} 55% 12%)`);
    bg.addColorStop(1, `hsl(${(hue + 42) % 360} 65% 24%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 144);

    const glow = ctx.createRadialGradient(188, 62, 4, 188, 62, 92);
    glow.addColorStop(0, `hsl(${hue} 90% 58% / 0.85)`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 144);

    // the "subject"
    ctx.fillStyle = `hsl(${(hue + 180) % 360} 25% 82%)`;
    ctx.beginPath();
    ctx.arc(190, 80, 34, 0, Math.PI * 2);
    ctx.fill();

    // headline blocks
    ctx.fillStyle = "rgb(255 255 255 / 0.92)";
    ctx.beginPath();
    ctx.roundRect(16, 82, 122, 21, 6);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue} 92% 62%)`;
    ctx.beginPath();
    ctx.roundRect(16, 110, 88, 17, 5);
    ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / 0.28)";
    ctx.beginPath();
    ctx.roundRect(16, 16, 56, 14, 7);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function makeDotTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgb(255 255 255 / 1)");
    g.addColorStop(0.35, "rgb(255 255 255 / 0.4)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface CardState {
  mesh: Mesh;
  vy: number;
  phase: number;
  spin: number;
}

const CARD_FIELD = { x: 11, yWrap: 7.5, zNear: -6, zFar: -28 };

// ─── HeroStage ────────────────────────────────────────────────────────
// Full-bleed WebGL backdrop: smoke + spotlights shader, a drifting wall
// of thumbnail cards, and dust motes. Camera follows the pointer.
export function HeroStage() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    const reduced = prefersReducedMotion();

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.fog = new FogExp2(0x05_05_05, 0.04);

    const camera = new PerspectiveCamera(55, 1, 0.1, 120);
    camera.position.set(0, 0, 9);

    // shader backdrop
    const bgMaterial = new ShaderMaterial({
      vertexShader: BG_VERTEX,
      fragmentShader: BG_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uAspect: { value: 1 } },
      depthWrite: false,
      fog: false,
    });
    const bgMesh = new Mesh(new PlaneGeometry(1, 1), bgMaterial);
    bgMesh.position.z = -38;
    scene.add(bgMesh);

    // floating thumbnail wall
    const isNarrow = window.innerWidth < 768;
    const cardCount = isNarrow ? 12 : 26;
    const textures = THUMB_HUES.map((hue) => makeThumbTexture(hue));
    const cardGeometry = new PlaneGeometry(1.6, 0.9);
    const cards: CardState[] = [];
    for (let i = 0; i < cardCount; i++) {
      const material = new MeshBasicMaterial({
        map: textures[i % textures.length],
        transparent: true,
      });
      const mesh = new Mesh(cardGeometry, material);
      const z =
        CARD_FIELD.zFar + Math.random() * (CARD_FIELD.zNear - CARD_FIELD.zFar);
      mesh.position.set(
        (Math.random() * 2 - 1) * CARD_FIELD.x,
        (Math.random() * 2 - 1) * CARD_FIELD.yWrap,
        z
      );
      const depth =
        (z - CARD_FIELD.zFar) / (CARD_FIELD.zNear - CARD_FIELD.zFar);
      material.opacity = 0.25 + depth * 0.65;
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.55,
        (Math.random() - 0.5) * 0.16
      );
      const scale = 0.7 + Math.random() * 0.9;
      mesh.scale.setScalar(scale);
      scene.add(mesh);
      cards.push({
        mesh,
        vy: 0.12 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
      });
    }

    // dust motes in the light
    const dotTexture = makeDotTexture();
    const dustCount = isNarrow ? 150 : 320;
    const dustPositions: number[] = [];
    for (let i = 0; i < dustCount; i++) {
      dustPositions.push(
        (Math.random() * 2 - 1) * 12,
        (Math.random() * 2 - 1) * 7,
        -4 - Math.random() * 20
      );
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(dustPositions, 3)
    );
    const dustMaterial = new PointsMaterial({
      size: 0.07,
      map: dotTexture,
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const dust = new Points(dustGeometry, dustMaterial);
    scene.add(dust);

    // pointer parallax
    const target = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
    };

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const aspect = width / Math.max(height, 1);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const planeHeight =
        2 *
        Math.abs(bgMesh.position.z - camera.position.z) *
        Math.tan((camera.fov * Math.PI) / 360);
      bgMesh.scale.set(planeHeight * aspect * 1.25, planeHeight * 1.25, 1);
      bgMaterial.uniforms.uAspect.value = aspect;
    };
    resize();

    const clock = new Clock();
    let raf = 0;
    let elapsed = 0;

    const renderFrame = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      bgMaterial.uniforms.uTime.value = elapsed;

      camera.position.x += (target.x * 1.7 - camera.position.x) * 0.04;
      camera.position.y += (-target.y * 1.1 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, -14);

      for (const card of cards) {
        card.mesh.position.y += card.vy * dt;
        card.mesh.rotation.z += card.spin * dt;
        card.mesh.position.x += Math.sin(elapsed * 0.4 + card.phase) * 0.0016;
        if (card.mesh.position.y > CARD_FIELD.yWrap) {
          card.mesh.position.y = -CARD_FIELD.yWrap;
          card.mesh.position.x = (Math.random() * 2 - 1) * CARD_FIELD.x;
        }
      }
      dust.rotation.y = elapsed * 0.012;
      dust.position.y = Math.sin(elapsed * 0.15) * 0.4;

      renderer.render(scene, camera);
    };

    const loop = () => {
      renderFrame();
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (reduced) {
        return;
      }
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        clock.getDelta();
        raf = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("resize", resize);
    if (reduced) {
      renderFrame();
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      cardGeometry.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      dotTexture.dispose();
      bgMaterial.dispose();
      bgMesh.geometry.dispose();
      for (const card of cards) {
        (card.mesh.material as MeshBasicMaterial).dispose();
      }
      for (const texture of textures) {
        texture.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[#050505]"
      ref={mountRef}
    />
  );
}

// ─── EmberField ───────────────────────────────────────────────────────
// Transparent overlay of rising embers for the closing CTA.
export function EmberField() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || prefersReducedMotion()) {
      return;
    }

    const renderer = new WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x00_00_00, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 60);
    camera.position.set(0, 0, 10);

    const dotTexture = makeDotTexture();
    const FIELD = { x: 9, y: 5.5, z: 3 };
    const count = 240;
    const positions = new Float32Array(count * 3);
    const speeds: number[] = [];
    const phases: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * FIELD.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * FIELD.y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * FIELD.z;
      speeds.push(0.25 + Math.random() * 0.6);
      phases.push(Math.random() * Math.PI * 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      size: 0.09,
      map: dotTexture,
      color: 0xff_aa_55,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const points = new Points(geometry, material);
    scene.add(points);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();

    const clock = new Clock();
    let raf = 0;
    let elapsed = 0;
    const attr = geometry.getAttribute("position");

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      for (let i = 0; i < count; i++) {
        let y = attr.getY(i) + speeds[i] * dt;
        if (y > FIELD.y) {
          y = -FIELD.y;
        }
        attr.setY(i, y);
        attr.setX(
          i,
          attr.getX(i) + Math.sin(elapsed * 0.8 + phases[i]) * 0.0024
        );
      }
      attr.needsUpdate = true;
      material.opacity = 0.55 + Math.sin(elapsed * 1.4) * 0.15;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        clock.getDelta();
        raf = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      dotTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      ref={mountRef}
    />
  );
}
