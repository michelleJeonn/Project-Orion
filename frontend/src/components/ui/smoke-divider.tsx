import { SmokeBackground } from './spooky-smoke-animation';

export function SmokeDivider() {
  return (
    <div
      style={{
        position: 'absolute',
        // Start a bit before the seam (left panel is 42%), extend into right panel
        left: '35%',
        width: '30%',
        top: 0,
        bottom: 0,
        zIndex: 10,
        pointerEvents: 'none',
        // Only vertical fade — horizontal fade is handled by the shader's xFade
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 9%, black 91%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 9%, black 91%, transparent 100%)',
      }}
    >
      <SmokeBackground smokeColor="#ede8df" />
    </div>
  );
}
