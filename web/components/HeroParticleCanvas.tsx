'use client';

import { useEffect, useRef } from 'react';

type Variant = 'crypto' | 'worldcup';

type Props = {
  variant: Variant;
};

const PARTICLE_COUNT = 42;
const LINK_DISTANCE = 168;
const MOUSE_RADIUS = 130;
const FRAME_INTERVAL = 1000 / 30;

const VARIANT_COLOR: Record<Variant, { r: number; g: number; b: number }> = {
  crypto: { r: 77, g: 168, b: 255 },
  worldcup: { r: 52, g: 211, b: 153 },
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.45,
    vy: (Math.random() - 0.5) * 0.45,
    radius: 1 + Math.random() * 1.4,
  };
}

export function HeroParticleCanvas({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const color = VARIANT_COLOR[variant];
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(width, height));
      } else {
        particles.forEach((p) => {
          if (p.x > width) p.x = Math.random() * width;
          if (p.y > height) p.y = Math.random() * height;
        });
      }
    };

    resize();

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    const handleMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.active = true;
    };
    const handleLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);

    let running = true;
    const io = new IntersectionObserver(
      (entries) => {
        running = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS && dist > 0.001) {
            const push = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            p.x += (dx / dist) * push * 1.4;
            p.y += (dy / dist) * push * 1.4;
          }
        }

        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        } else if (p.x > width) {
          p.x = width;
          p.vx *= -1;
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        } else if (p.y > height) {
          p.y = height;
          p.vy *= -1;
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.lineCap = 'round';
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= LINK_DISTANCE) continue;
          const alpha = (1 - dist / LINK_DISTANCE) * 0.55;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          // 控制点：中点上方偏移，做出向上弯曲的弧 — 呼应 Arc 品牌
          const cx = mx + (-dy) * 0.18;
          const cy = my + dx * 0.18 - Math.min(28, dist * 0.12);
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cx, cy, b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.95)`;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    let rafId = 0;
    let lastFrame = 0;

    const loop = (ts: number) => {
      rafId = window.requestAnimationFrame(loop);
      if (!running) return;
      if (ts - lastFrame < FRAME_INTERVAL) return;
      lastFrame = ts;
      step();
      render();
    };

    if (reduceMotion) {
      step();
      render();
    } else {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [variant]);

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}
