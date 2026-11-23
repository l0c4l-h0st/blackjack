import { useEffect, useRef } from 'react';
import { particles } from '../../fx/particles';

/** Calque Canvas plein écran pour les particules (ne capte pas les clics). */
export function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    particles.attach(canvas);
    const onResize = () => particles.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      particles.detach();
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[110] h-full w-full"
      aria-hidden="true"
    />
  );
}
