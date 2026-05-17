import bgImage from '../assets/Snipaste_2026-05-17_11-45-36.png'

export default function GalaxyBackground() {
  return (
    <div
      className="galaxy-layer"
      style={{ backgroundImage: `url(${bgImage})` }}
    />
  )
}
