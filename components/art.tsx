// Inline SVG pieces for the Kitchen Table look: flat fills, 3px ink outlines, nothing shaded.
// Colours are the palette in tailwind.config.ts, written out because SVG attributes can't use classes.
import type React from "react"

export const INK = "#231F1A"
export const PAPER = "#F4EDE0"
export const SURFACE = "#FFFDF7"
export const TAN = "#D9B382"
export const MUSTARD = "#E0A526"
export const YOU = "#E4572E"
export const FRIEND = "#2F7F79"

const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const }

type IconProps = { className?: string; title?: string }

function Svg({ children, className, title, viewBox = "0 0 64 64" }: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
      {children}
    </svg>
  )
}

export function PhoneObject(p: IconProps) {
  return (
    <Svg {...p}>
      <PhoneInner />
    </Svg>
  )
}

export function NotepadObject(p: IconProps) {
  return (
    <Svg {...p}>
      <NotepadInner />
    </Svg>
  )
}

export function SketchbookObject(p: IconProps) {
  return (
    <Svg {...p}>
      <SketchInner />
    </Svg>
  )
}

export function TvObject(p: IconProps) {
  return (
    <Svg {...p}>
      <TvInner />
    </Svg>
  )
}

/** A chair, side-on and facing the table (to the right). With `occupied`, someone sits in it. */
export function Chair({
  color,
  occupied,
  flip,
  className,
  title,
}: {
  color: string
  occupied: boolean
  flip?: boolean
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 92 150"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <ChairInner color={color} occupied={occupied} />
    </svg>
  )
}

/** The whole entry illustration: lamp, table, four things on it, two chairs. */
export function TableScene({ friendHere = false, className }: { friendHere?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 520 300" className={className} role="img" aria-label={friendHere ? "A table with both chairs taken" : "A table with two chairs. One is empty."} focusable="false">
      {/* pendant lamp */}
      <path d="M260 0v44" {...stroke} />
      <path d="M222 86q0-42 38-42t38 42z" fill={MUSTARD} {...stroke} />
      {/* things on the table, back row */}
      <svg x="118" y="106" width="76" height="76" viewBox="0 0 64 64"><NotepadInner /></svg>
      <svg x="198" y="104" width="76" height="76" viewBox="0 0 64 64"><SketchInner /></svg>
      <svg x="278" y="102" width="80" height="80" viewBox="0 0 64 64"><TvInner /></svg>
      <svg x="364" y="108" width="72" height="72" viewBox="0 0 64 64"><PhoneInner /></svg>
      {/* table */}
      <rect x="92" y="180" width="336" height="22" rx="5" fill={TAN} {...stroke} />
      <rect x="116" y="202" width="14" height="82" rx="2" fill={TAN} {...stroke} />
      <rect x="390" y="202" width="14" height="82" rx="2" fill={TAN} {...stroke} />
      <path d="M20 292h480" {...stroke} strokeWidth={2.5} />
      {/* chairs */}
      <svg x="4" y="138" width="92" height="150" viewBox="0 0 92 150">
        <ChairInner color={YOU} occupied />
      </svg>
      <g transform="translate(516 0) scale(-1 1)">
        <svg x="4" y="138" width="92" height="150" viewBox="0 0 92 150">
          <ChairInner color={FRIEND} occupied={friendHere} />
        </svg>
      </g>
    </svg>
  )
}

// The icon bodies without their <svg> wrapper, so the scene can nest them.
function NotepadInner() {
  return (
    <>
      <rect x="14" y="9" width="37" height="47" rx="3" fill={SURFACE} {...stroke} />
      <rect x="14" y="9" width="37" height="9" rx="3" fill={MUSTARD} {...stroke} />
      <path d="M21 28h23M21 36h23M21 44h14" {...stroke} strokeWidth={2.5} />
    </>
  )
}
function SketchInner() {
  return (
    <>
      <rect x="8" y="13" width="48" height="40" rx="3" fill={TAN} {...stroke} />
      <rect x="14" y="19" width="36" height="28" rx="2" fill={SURFACE} {...stroke} strokeWidth={2.5} />
      <path d="M19 40q6-15 12-3t13-6" fill="none" stroke={YOU} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx="42" cy="27" r="3.5" fill={FRIEND} />
    </>
  )
}
function TvInner() {
  return (
    <>
      <path d="M22 18l10-9 10 9" fill="none" {...stroke} strokeWidth={2.5} />
      <rect x="7" y="18" width="50" height="35" rx="5" fill={FRIEND} {...stroke} />
      <rect x="12" y="23" width="31" height="25" rx="3" fill={SURFACE} {...stroke} strokeWidth={2.5} />
      <circle cx="50" cy="29" r="2.5" fill={SURFACE} />
      <circle cx="50" cy="39" r="2.5" fill={SURFACE} />
      <path d="M16 53v4M48 53v4" {...stroke} />
    </>
  )
}
function PhoneInner() {
  return (
    <>
      <rect x="9" y="36" width="46" height="19" rx="5" fill={YOU} {...stroke} />
      <circle cx="32" cy="45.5" r="5" fill={SURFACE} {...stroke} strokeWidth={2.5} />
      <rect x="10" y="19" width="44" height="12" rx="6" fill={INK} {...stroke} />
      <path d="M17 31v5M47 31v5" {...stroke} />
    </>
  )
}
function ChairInner({ color, occupied }: { color: string; occupied: boolean }) {
  const wood = occupied ? TAN : PAPER
  const dash = occupied ? undefined : "6 5"
  return (
    <>
      <rect x="12" y="116" width="9" height="30" rx="2" fill={wood} {...stroke} strokeDasharray={dash} />
      <rect x="64" y="116" width="9" height="30" rx="2" fill={wood} {...stroke} strokeDasharray={dash} />
      <rect x="8" y="40" width="11" height="80" rx="3" fill={wood} {...stroke} strokeDasharray={dash} />
      <rect x="8" y="106" width="68" height="12" rx="3" fill={wood} {...stroke} strokeDasharray={dash} />
      {occupied && (
        <g className="kt-sit">
          <rect x="26" y="60" width="42" height="48" rx="16" fill={color} {...stroke} />
          <circle cx="47" cy="38" r="17" fill={SURFACE} {...stroke} />
          <circle cx="42" cy="37" r="2" fill={INK} />
          <circle cx="53" cy="37" r="2" fill={INK} />
          <path d="M42 45q5.5 4 11 0" fill="none" {...stroke} strokeWidth={2.2} />
        </g>
      )}
    </>
  )
}
