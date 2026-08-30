/**
 * Offline-safe bike artwork. Renders a stylised side-view SVG per bike type,
 * so the catalog always shows imagery even without external images.
 * If a product has an `image` URL it is used instead (see ProductCard).
 */
const DEFAULT_COLOR = "#e30917";

const Warp = { VectorEffect: "non-scaling-stroke" };

function Wheels({ size = 46, cy = 152, x1 = 60, x2 = 210, color = "#222" }) {
  return (
    <g>
      <circle cx={x1} cy={cy} r={size} fill="#1c1c1e" />
      <circle cx={x1} cy={cy} r={size - 8} fill="none" stroke="#f2f2f3" strokeWidth="5" />
      <circle cx={x1} cy={cy} r={size - 8} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={x1} cy={cy} r={size - 18} fill="none" stroke="#2c2c2f" strokeWidth="2" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line
          key={a}
          x1={x1}
          y1={cy}
          x2={x1 + (size - 10) * Math.cos((a * Math.PI) / 180)}
          y2={cy + (size - 10) * Math.sin((a * Math.PI) / 180)}
          stroke="#2c2c2f"
          strokeWidth="2"
        />
      ))}
      <circle cx={x1} cy={cy} r={5} fill="#333" />
      <circle cx={x2} cy={cy} r={size} fill="#1c1c1e" />
      <circle cx={x2} cy={cy} r={size - 8} fill="none" stroke="#f2f2f3" strokeWidth="5" />
      <circle cx={x2} cy={cy} r={size - 8} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={x2} cy={cy} r={size - 18} fill="none" stroke="#2c2c2f" strokeWidth="2" />
      {[36, 108, 180, 252, 324].map((a) => (
        <line
          key={a}
          x1={x2}
          y1={cy}
          x2={x2 + (size - 10) * Math.cos((a * Math.PI) / 180)}
          y2={cy + (size - 10) * Math.sin((a * Math.PI) / 180)}
          stroke="#2c2c2f"
          strokeWidth="2"
        />
      ))}
      <circle cx={x2} cy={cy} r={5} fill="#333" />
    </g>
  );
}

function SportBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Sport bike">
      <Wheels color={c} x1={72} x2={218} />
      <path d="M92 150 C110 150 120 132 132 118 C148 99 172 78 200 78 L214 82 C196 88 176 118 164 132 C154 144 130 150 92 150 Z" fill={c} />
      <path d="M132 96 C150 74 178 64 202 68 L210 72 C184 72 158 88 140 104 Z" fill={c} />
      <rect x="118" y="88" width="52" height="30" rx="14" fill="#202024" />
      <rect x="124" y="94" width="20" height="12" rx="4" fill="#111" />
      <circle cx="120" cy="120" r="10" fill="#202024" />
      <circle cx="120" cy="120" r="5" fill="#fff" />
      <path d="M60 152 C54 140 62 128 76 122 L70 152 Z" fill="#202024" />
      <path d="M212 70 L240 44" stroke="#202024" strokeWidth="6" strokeLinecap="round" />
      <circle cx="246" cy="39" r="7" fill="#202024" />
      <path d="M232 46 C238 44 244 44 248 46" stroke="#333" strokeWidth="3" fill="none" />
      <path d="M60 150 h8 M218 150 h8" stroke="#cfcfcf" strokeWidth="2" />
    </svg>
  );
}

function CommuterBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Commuter bike">
      <Wheels color={c} x1={68} x2={216} size={44} />
      <path d="M96 148 C112 146 122 132 132 120 L150 96 L178 96 C168 112 158 128 148 138 C136 150 116 152 96 148 Z" fill={c} />
      <path d="M150 96 L178 92 L188 84 L196 76 L206 84 L194 96 Z" fill={c} />
      <rect x="118" y="92" width="42" height="26" rx="12" fill="#202024" />
      <rect x="124" y="98" width="16" height="10" rx="3" fill="#111" />
      <circle cx="122" cy="118" r="9" fill="#202024" />
      <circle cx="122" cy="118" r="4" fill="#fff" />
      <path d="M64 150 L60 128 L80 120 L82 150" fill="#202024" />
      <path d="M208 72 L238 40" stroke="#202024" strokeWidth="6" strokeLinecap="round" />
      <circle cx="242" cy="36" r="6" fill="#202024" />
      <rect x="88" y="132" width="42" height="12" rx="5" fill="#333" />
    </svg>
  );
}

function CruiserBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Cruiser bike">
      <Wheels color={c} x1={70} x2={210} size={42} />
      <path d="M96 150 C120 148 136 136 146 122 L170 112 L188 116 L162 138 C150 150 120 154 96 150 Z" fill={c} />
      <rect x="120" y="108" width="56" height="24" rx="12" fill="#202024" />
      <rect x="176" y="92" width="26" height="16" rx="6" fill={c} />
      <circle cx="124" cy="120" r="9" fill="#202024" />
      <circle cx="124" cy="120" r="4" fill="#fff" />
      <path d="M64 148 L58 132 L66 124 L76 132 L74 148" fill="#202024" />
      <path d="M206 76 L232 40" stroke="#202024" strokeWidth="7" strokeLinecap="round" />
      <circle cx="236" cy="36" r="7" fill="#202024" />
      <path d="M170 118 L196 148" stroke="#333" strokeWidth="5" strokeLinecap="round" />
      <rect x="92" y="138" width="34" height="10" rx="5" fill="#333" />
    </svg>
  );
}

function AdventureBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Adventure bike">
      <Wheels color={c} x1={66} x2={216} size={46} />
      <path d="M92 148 C110 146 122 134 132 120 L156 104 C146 118 138 132 128 142 C118 150 104 152 92 148 Z" fill={c} />
      <rect x="120" y="92" width="52" height="28" rx="12" fill="#202024" />
      <rect x="126" y="98" width="20" height="12" rx="4" fill="#111" />
      <circle cx="122" cy="118" r="9" fill="#202024" />
      <circle cx="122" cy="118" r="4" fill="#fff" />
      <path d="M64 150 L92 132 L96 150" fill="#202024" />
      <path d="M158 100 L190 74 L196 74" stroke="#202024" strokeWidth="6" strokeLinecap="round" />
      <circle cx="204" cy="70" r="6" fill="#202024" />
      <rect x="200" y="62" width="26" height="16" rx="4" fill="#202024" />
      <path d="M208 92 L232 66" stroke="#202024" strokeWidth="6" strokeLinecap="round" />
      <circle cx="236" cy="62" r="6" fill="#202024" />
      <path d="M64 150 h8 M216 150 h8" stroke="#cfcfcf" strokeWidth="2" />
      <rect x="168" y="132" width="40" height="14" rx="6" fill="#333" />
    </svg>
  );
}

function ScooterBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Scooter">
      <Wheels color={c} x1={70} x2={206} size={38} />
      <path d="M92 150 C104 150 110 142 112 132 L118 112 C150 112 180 116 200 126 L206 138 C194 148 120 152 92 150 Z" fill={c} />
      <path d="M118 112 C120 92 136 84 152 86 L150 96 C140 94 128 100 126 112 Z" fill={c} />
      <rect x="150" y="82" width="40" height="22" rx="8" fill="#202024" />
      <path d="M118 112 L112 104 L132 98 L136 110" fill={c} />
      <path d="M92 132 L80 128 L86 118 L96 122" fill="#202024" />
      <circle cx="164" cy="104" r="8" fill="#202024" />
      <circle cx="164" cy="104" r="3.5" fill="#fff" />
      <path d="M200 92 C200 82 206 74 214 72 L212 80 L222 78" stroke="#202024" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="226" cy="78" r="6" fill="#202024" />
      <rect x="98" y="140" width="28" height="8" rx="4" fill="#333" />
    </svg>
  );
}

function ElectricBike({ c }) {
  return (
    <svg viewBox="0 0 280 190" role="img" aria-label="Electric scooter">
      <Wheels color={c} x1={72} x2={204} size={38} />
      <rect x="96" y="96" width="60" height="52" rx="14" fill={c} />
      <rect x="110" y="110" width="32" height="24" rx="6" fill="#fff" opacity="0.9" />
      <path d="M120 116 L118 128 L124 128 L122 138 L130 124 L124 124 L126 116 Z" fill={c} />
      <path d="M156 112 C164 92 184 84 200 90 L196 102 C184 98 172 102 166 114 Z" fill={c} />
      <rect x="150" y="82" width="36" height="22" rx="8" fill="#202024" />
      <path d="M72 128 L64 126 L68 116 L76 118" fill="#202024" />
      <path d="M204 94 C206 84 214 78 224 78 L222 88 L232 86" stroke="#202024" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="234" cy="86" r="6" fill="#202024" />
      <circle cx="120" cy="150" r="6" fill="#202024" />
    </svg>
  );
}

const byType = {
  Sport: SportBike,
  Cruiser: CruiserBike,
  Commuter: CommuterBike,
  Adventure: AdventureBike,
  "Off-road": AdventureBike,
  Scooter: ScooterBike,
  Electric: ElectricBike,
};

export default function BikeArt({ type = "Commuter", color = DEFAULT_COLOR }) {
  const Comp = byType[type] || CommuterBike;
  return <Comp c={color} />;
}
