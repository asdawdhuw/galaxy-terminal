import bgImage from '../assets/Snipaste_2026-05-17_11-45-36.png'
import Starfield from './Starfield'

export default function GalaxyBackground({ showScanLine = true }) {
  return (
    <>
      <div
        className="galaxy-layer absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-hidden
      />
      <Starfield />
      {showScanLine && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }} aria-hidden>
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-cosmos-accent/20 to-transparent animate-scan-line" />
        </div>
      )}
      <div
        className="absolute inset-0 pointer-events-none nebula-overlay"
        style={{ zIndex: 2 }}
        aria-hidden
      />
    </>
  )
}
