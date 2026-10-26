const star = "0,-3 0.9,-0.9 3,-0.9 1.4,0.5 1.9,2.8 0,1.4 -1.9,2.8 -1.4,0.5 -3,-0.9 -0.9,-0.9"

/** Decorative vector flags; country names remain visible link text. DE is the Europe filter. */
export default function AuctionFlag({ country }: { country: string }) {
  return <span className="lw-auction-flag" data-country={country} aria-hidden="true">
    <svg viewBox="0 0 30 20" focusable="false">
      <rect width="30" height="20" fill={country === "CN" ? "#de2910" : country === "DE" ? "#003399" : "#fff"} />
      {country === "JP" && <circle cx="15" cy="10" r="6" fill="#bc002d" />}
      {country === "CN" && <g fill="#ffde00"><polygon points={star} transform="translate(6 6)" />{[[11, 3], [13, 6], [13, 9], [11, 12]].map(([x, y]) => <polygon key={y} points={star} transform={`translate(${x} ${y}) scale(.33)`} />)}</g>}
      {country === "US" && <><g fill="#b22234">{Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 40 / 13} width="30" height={20 / 13} />)}</g><rect width="12" height="10.8" fill="#3c3b6e" /><g fill="#fff">{Array.from({ length: 9 }, (_, row) => Array.from({ length: row % 2 ? 5 : 6 }, (_, col) => <circle key={`${row}-${col}`} cx={1 + col * 2 + (row % 2 ? 1 : 0)} cy={1 + row * 1.1} r=".38" />))}</g></>}
      {country === "DE" && <g fill="#ffcc00">{Array.from({ length: 12 }, (_, i) => <polygon key={i} points={star} transform={`translate(${15 + Math.sin(i * Math.PI / 6) * 6} ${10 - Math.cos(i * Math.PI / 6) * 6}) scale(.33)`} />)}</g>}
      {country === "KR" && <><circle cx="15" cy="10" r="4.5" fill="#cd2e3a" /><path d="M10.5 10a4.5 4.5 0 0 0 9 0 2.25 2.25 0 0 0-4.5 0 2.25 2.25 0 0 1-4.5 0" fill="#0047a0" /><g stroke="#111" strokeWidth=".8">{[
        { x: 7, y: 4, angle: -55, broken: [false, false, false] },
        { x: 23, y: 4, angle: 55, broken: [true, false, true] },
        { x: 7, y: 16, angle: 55, broken: [false, true, false] },
        { x: 23, y: 16, angle: -55, broken: [true, true, true] },
      ].map((trigram) => <g key={trigram.x + ":" + trigram.y} transform={`translate(${trigram.x} ${trigram.y}) rotate(${trigram.angle})`}>{trigram.broken.map((broken, i) => <path key={i} d={broken ? `M-2.5 ${i * 1.3 - 1.3}h2m1 0h2` : `M-2.5 ${i * 1.3 - 1.3}h5`} />)}</g>)}</g></>}
    </svg>
  </span>
}
