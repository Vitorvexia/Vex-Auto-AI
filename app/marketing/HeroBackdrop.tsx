// Ambiente decorativo da hero — silhuetas geométricas (carro + moto), no
// mesmo estilo low-poly/flat da raposa (ver DESIGN.md, seção Shapes). Não é
// foto real de loja — sem asset licenciado disponível, a solução dentro da
// marca é geometria angular, não fotografia.
export function HeroBackdrop() {
  return (
    <svg
      className="mkt-hero-backdrop"
      viewBox="0 0 900 170"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <line x1="0" y1="156" x2="900" y2="156" className="mkt-backdrop-floor" />

      <g className="mkt-backdrop-vehicle" transform="translate(70,70)">
        <circle cx="20" cy="72" r="16" />
        <circle cx="132" cy="72" r="16" />
        <polyline points="20,72 55,44 88,33 108,44 132,72" />
        <polyline points="72,37 93,35" />
        <polyline points="101,25 117,35" />
      </g>

      <g className="mkt-backdrop-vehicle" transform="translate(430,40)">
        <polygon points="10,90 10,64 38,64 56,38 148,38 172,60 210,64 210,90" />
        <polyline points="60,62 74,42 132,42 150,62" />
        <circle cx="46" cy="92" r="16" />
        <circle cx="176" cy="92" r="16" />
      </g>
    </svg>
  );
}
