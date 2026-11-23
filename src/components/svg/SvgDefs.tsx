/**
 * Symboles SVG partagés (enseignes, motif du dos de carte), insérés une seule fois dans le DOM
 * et référencés via `<use href="#…">`. Dessins originaux.
 */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="suit-H" viewBox="0 0 100 100">
          <path d="M50 88C47 84 8 60 8 33 8 18 19 9 31 9c9 0 16 5 19 13 3-8 10-13 19-13 12 0 23 9 23 24 0 27-39 51-42 55z" />
        </symbol>
        <symbol id="suit-D" viewBox="0 0 100 100">
          <path d="M50 4Q68 30 90 50 68 70 50 96 32 70 10 50 32 30 50 4z" />
        </symbol>
        <symbol id="suit-S" viewBox="0 0 100 100">
          <path d="M50 6c6 16 42 34 42 56 0 14-11 22-22 22-8 0-14-4-17-10 1 10 5 16 13 21H34c8-5 12-11 13-21-3 6-9 10-17 10-11 0-22-8-22-22C8 40 44 22 50 6z" />
        </symbol>
        <symbol id="suit-C" viewBox="0 0 100 100">
          <circle cx="50" cy="28" r="19" />
          <circle cx="27" cy="58" r="19" />
          <circle cx="73" cy="58" r="19" />
          <circle cx="50" cy="54" r="11" />
          <path d="M45 56c1 18-3 30-11 39h32c-8-9-12-21-11-39z" />
        </symbol>

        <pattern
          id="card-back-lattice"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="16" height="16" fill="#121828" />
          <rect x="6" y="6" width="4" height="4" style={{ fill: 'var(--accent)' }} opacity="0.55" />
          <path
            d="M0 8h16M8 0v16"
            style={{ stroke: 'var(--accent)' }}
            strokeWidth="0.6"
            opacity="0.25"
          />
        </pattern>
        <radialGradient id="card-back-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="chip-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  );
}
