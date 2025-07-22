import '@testing-library/jest-dom'

// Mock Firebase
jest.mock('./src/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' },
  },
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}))

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}))

// Mock Google Maps
global.google = {
  maps: {
    Map: jest.fn(() => ({
      setCenter: jest.fn(),
      setZoom: jest.fn(),
      addListener: jest.fn(),
    })),
    Marker: jest.fn(() => ({
      setPosition: jest.fn(),
      addListener: jest.fn(),
    })),
    places: {
      SearchBox: jest.fn(() => ({
        addListener: jest.fn(),
      })),
      PlacesService: jest.fn(() => ({
        textSearch: jest.fn(),
      })),
      PlacesServiceStatus: {
        OK: 'OK',
      },
    },
    Geocoder: jest.fn(() => ({
      geocode: jest.fn(),
    })),
  },
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn((success) =>
    success({
      coords: {
        latitude: 19.4326,
        longitude: -99.1332,
      },
    })
  ),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
})

// Mock Notification API
global.Notification = {
  requestPermission: jest.fn(() => Promise.resolve('granted')),
}

// Suppress console warnings during tests
const originalConsoleWarn = console.warn
beforeEach(() => {
  console.warn = jest.fn()
})

afterEach(() => {
  console.warn = originalConsoleWarn
})