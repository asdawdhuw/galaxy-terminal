import bgImage from '../assets/Snipaste_2026-05-17_11-45-36.png'
import Starfield from './Starfield'

export default function GalaxyBackground({ chillMode }) {
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImage})`,
          zIndex: -1,
          filter: chillMode ? 'brightness(0.35) saturate(0.6)' : 'brightness(0.5)',
          transition: 'filter 0.8s ease',
        }}
        aria-hidden
      />
      <Starfield chillMode={chillMode} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(61,127,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(40,80,160,0.05) 0%, transparent 50%)'
        }}
        aria-hidden
      />
    </>
  )
}
