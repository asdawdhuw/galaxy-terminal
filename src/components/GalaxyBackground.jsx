import bgImage from '../assets/Snipaste_2026-05-17_11-45-36.png'
import Starfield from './Starfield'

export default function GalaxyBackground() {
  return (
    <>
      <div
        className="galaxy-layer absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-hidden
      />
      <Starfield />
      <div
        className="absolute inset-0 pointer-events-none nebula-overlay"
        style={{ zIndex: 2 }}
        aria-hidden
      />
    </>
  )
}
