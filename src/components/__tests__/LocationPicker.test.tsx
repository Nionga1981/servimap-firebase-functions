import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LocationPicker from '../map/LocationPicker'

// Mock Google Maps API
const mockMap = {
  setCenter: jest.fn(),
  setZoom: jest.fn(),
  addListener: jest.fn(),
}

const mockMarker = {
  setPosition: jest.fn(),
  addListener: jest.fn(),
}

const mockSearchBox = {
  addListener: jest.fn(),
}

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks()
  
  // Setup Google Maps mocks
  global.google = {
    maps: {
      Map: jest.fn(() => mockMap),
      Marker: jest.fn(() => mockMarker),
      places: {
        SearchBox: jest.fn(() => mockSearchBox),
        PlacesService: jest.fn(() => ({
          textSearch: jest.fn((request, callback) => {
            callback([
              {
                place_id: '1',
                name: 'Test Location',
                formatted_address: 'Test Address',
                geometry: {
                  location: {
                    lat: () => 19.4326,
                    lng: () => -99.1332,
                  },
                },
              },
            ], 'OK')
          }),
        })),
        PlacesServiceStatus: {
          OK: 'OK',
        },
      },
      Geocoder: jest.fn(() => ({
        geocode: jest.fn((request, callback) => {
          callback([
            {
              formatted_address: 'Test Reverse Geocoded Address',
            },
          ], 'OK')
        }),
      })),
    },
  }
})

describe('LocationPicker', () => {
  const mockOnLocationSelect = jest.fn()

  beforeEach(() => {
    mockOnLocationSelect.mockClear()
  })

  it('renders without crashing', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    expect(screen.getByPlaceholderText('Buscar dirección o lugar...')).toBeInTheDocument()
  })

  it('shows search box when enabled', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} showSearchBox={true} />)
    expect(screen.getByPlaceholderText('Buscar dirección o lugar...')).toBeInTheDocument()
  })

  it('hides search box when disabled', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} showSearchBox={false} />)
    expect(screen.queryByPlaceholderText('Buscar dirección o lugar...')).not.toBeInTheDocument()
  })

  it('displays current location button', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    expect(screen.getByText('Usar mi ubicación')).toBeInTheDocument()
  })

  it('handles search input changes', async () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    
    const searchInput = screen.getByPlaceholderText('Buscar dirección o lugar...')
    fireEvent.change(searchInput, { target: { value: 'Test search' } })
    
    expect(searchInput).toHaveValue('Test search')
  })

  it('shows manual coordinates entry when enabled', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} allowManualEntry={true} />)
    expect(screen.getByText('O ingresa coordenadas manualmente:')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Latitud')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Longitud')).toBeInTheDocument()
  })

  it('hides manual coordinates entry when disabled', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} allowManualEntry={false} />)
    expect(screen.queryByText('O ingresa coordenadas manualmente:')).not.toBeInTheDocument()
  })

  it('shows action buttons when onLocationSelect is provided', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
    expect(screen.getByText('Confirmar ubicación')).toBeInTheDocument()
  })

  it('calls onLocationSelect when confirm button is clicked with a location', async () => {
    const initialLocation = { lat: 19.4326, lng: -99.1332 }
    render(
      <LocationPicker 
        onLocationSelect={mockOnLocationSelect} 
        initialLocation={initialLocation}
      />
    )

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirmar ubicación')
      expect(confirmButton).not.toBeDisabled()
    })

    const confirmButton = screen.getByText('Confirmar ubicación')
    fireEvent.click(confirmButton)

    expect(mockOnLocationSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: initialLocation.lat,
        lng: initialLocation.lng,
      })
    )
  })

  it('calls onLocationSelect with null when cancel button is clicked', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    
    const cancelButton = screen.getByText('Cancelar')
    fireEvent.click(cancelButton)

    expect(mockOnLocationSelect).toHaveBeenCalledWith(null)
  })

  it('handles current location button click', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    
    const currentLocationButton = screen.getByText('Usar mi ubicación')
    fireEvent.click(currentLocationButton)

    // Should trigger geolocation API (mocked)
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled()
  })

  it('displays map loading state initially', () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} />)
    expect(screen.getByText('Cargando mapa...')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <LocationPicker 
        onLocationSelect={mockOnLocationSelect} 
        className="custom-class"
      />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('uses custom map height', () => {
    render(
      <LocationPicker 
        onLocationSelect={mockOnLocationSelect} 
        mapHeight="500px"
      />
    )
    
    // The map container should have the specified height
    const mapContainer = document.querySelector('[style*="height: 500px"]')
    expect(mapContainer).toBeInTheDocument()
  })

  it('handles coordinate input changes', async () => {
    render(<LocationPicker onLocationSelect={mockOnLocationSelect} allowManualEntry={true} />)
    
    const latInput = screen.getByPlaceholderText('Latitud')
    const lngInput = screen.getByPlaceholderText('Longitud')
    
    fireEvent.change(latInput, { target: { value: '20.0' } })
    fireEvent.change(lngInput, { target: { value: '-100.0' } })
    
    expect(latInput).toHaveValue(20)
    expect(lngInput).toHaveValue(-100)
  })
})