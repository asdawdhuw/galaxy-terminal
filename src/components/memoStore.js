let _id = 0
const genId = () => `mm-${++_id}`
const randSpeed = () => (0.00025 + Math.random() * 0.0008) * (Math.random() > 0.5 ? 1 : -1)

const store = {
  stars: [],
  planets: [],
  subs: new Set()
}
function notify() { store.subs.forEach(fn => fn()) }

export const memoStore = {
  createStar(name) {
    store.stars.push({
      id: genId(), name: name || `Star ${store.stars.length + 1}`, content: '',
      position: { x: 180 + Math.random() * 500, y: 120 + Math.random() * 380 }
    })
    notify()
  },
  addPlanet(name, starId) {
    store.planets.push({
      id: genId(), name: name || `Planet ${store.planets.length + 1}`, content: '',
      starId: starId || null, isCaptured: false,
      orbitR: 70 + Math.random() * 60, speed: randSpeed(),
      angle: Math.random() * Math.PI * 2, x: 300 + Math.random() * 300, y: 200 + Math.random() * 200
    })
    notify()
  },
  removeStar(id) {
    store.stars = store.stars.filter(s => s.id !== id)
    store.planets = store.planets.filter(p => p.starId !== id)
    notify()
  },
  removePlanet(id) {
    store.planets = store.planets.filter(p => p.id !== id)
    notify()
  },
  clearAll() { store.stars = []; store.planets = []; notify() }
}

export { store, notify, genId, randSpeed }
