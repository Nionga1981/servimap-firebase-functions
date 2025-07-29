'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Clock, 
  Star, 
  Filter,
  X,
  Mic,
  Camera,
  History,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function SearchBar({ 
  onSearch, 
  placeholder = "Busca servicios o negocios cerca de ti",
  autoFocus = false,
  showFilters = true,
  className = ""
}) {
  const navigate = useNavigate();
  const { currentLocation } = useLocation();
  const { user } = useAuth();
  
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [quickFilters, setQuickFilters] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const recognition = useRef(null);

  // Filtros rápidos predefinidos
  const defaultQuickFilters = [
    { id: 'available_now', label: 'Disponible ahora', icon: Clock, active: false },
    { id: 'near_me', label: 'Cerca de mí', icon: MapPin, active: false },
    { id: 'top_rated', label: 'Mejor calificado', icon: Star, active: false },
    { id: 'trending', label: 'Populares', icon: TrendingUp, active: false }
  ];

  // Inicializar filtros y historial
  useEffect(() => {
    setQuickFilters(defaultQuickFilters);
    loadSearchHistory();
    initializeVoiceRecognition();
  }, []);

  // Auto focus si se especifica
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced search suggestions
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length > 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Cargar historial de búsquedas desde localStorage
  const loadSearchHistory = () => {
    try {
      const saved = localStorage.getItem(`servimap_search_history_${user?.uid}`);
      if (saved) {
        setSearchHistory(JSON.parse(saved).slice(0, 5)); // Últimas 5 búsquedas
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  // Guardar búsqueda en historial
  const saveToHistory = (searchTerm) => {
    try {
      const newHistory = [
        searchTerm,
        ...searchHistory.filter(item => item !== searchTerm)
      ].slice(0, 5);
      
      setSearchHistory(newHistory);
      localStorage.setItem(
        `servimap_search_history_${user?.uid}`, 
        JSON.stringify(newHistory)
      );
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  // Obtener sugerencias de búsqueda (integración con OpenAI)
  const fetchSuggestions = async (searchTerm) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTerm,
          location: currentLocation,
          language: 'es',
          filters: quickFilters.filter(f => f.active)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Inicializar reconocimiento de voz
  const initializeVoiceRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'es-MX';

      recognition.current.onstart = () => {
        setIsListening(true);
      };

      recognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
        performSearch(transcript);
      };

      recognition.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Error de reconocimiento",
          description: "No se pudo procesar el audio. Intenta de nuevo.",
          variant: "destructive"
        });
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  // Realizar búsqueda
  const performSearch = (searchTerm = query) => {
    if (!searchTerm.trim()) return;

    const searchData = {
      query: searchTerm.trim(),
      filters: quickFilters.filter(f => f.active),
      location: currentLocation
    };

    // Guardar en historial
    saveToHistory(searchTerm.trim());

    // Limpiar estado
    setIsActive(false);
    setSuggestions([]);

    // Ejecutar búsqueda
    if (onSearch) {
      onSearch(searchData);
    } else {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  // Toggle filtro rápido
  const toggleQuickFilter = (filterId) => {
    setQuickFilters(prev => 
      prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, active: !filter.active }
          : filter
      )
    );
  };

  // Iniciar búsqueda por voz
  const startVoiceSearch = () => {
    if (recognition.current) {
      recognition.current.start();
    } else {
      toast({
        title: "Función no disponible",
        description: "Tu navegador no soporta reconocimiento de voz",
        variant: "destructive"
      });
    }
  };

  // Búsqueda por imagen (placeholder)
  const startImageSearch = () => {
    toast({
      title: "Próximamente",
      description: "La búsqueda por imagen estará disponible pronto",
      variant: "default"
    });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Barra de búsqueda principal */}
      <div className={`
        relative flex items-center bg-white border rounded-full shadow-sm transition-all duration-200
        ${isActive ? 'border-purple-300 shadow-md' : 'border-gray-200'}
      `}>
        <Search className="h-5 w-5 text-gray-400 ml-4" />
        
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsActive(true)}
          onBlur={() => setTimeout(() => setIsActive(false), 200)}
          onKeyDown={(e) => e.key === 'Enter' && performSearch()}
          className="flex-1 border-none shadow-none focus:ring-0 bg-transparent px-3"
        />

        {/* Botones de acción */}
        <div className="flex items-center space-x-1 mr-2">
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery('')}
              className="p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={startVoiceSearch}
            disabled={isListening}
            className={`p-1 h-auto ${isListening ? 'text-red-500 animate-pulse' : ''}`}
          >
            <Mic className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={startImageSearch}
            className="p-1 h-auto"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros rápidos */}
      {showFilters && (
        <div className="flex items-center space-x-2 mt-3 overflow-x-auto pb-2">
          {quickFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <Badge
                key={filter.id}
                variant={filter.active ? "default" : "secondary"}
                className={`
                  cursor-pointer whitespace-nowrap transition-colors hover:scale-105
                  ${filter.active 
                    ? 'bg-purple-500 hover:bg-purple-600' 
                    : 'hover:bg-gray-200'
                  }
                `}
                onClick={() => toggleQuickFilter(filter.id)}
              >
                <Icon className="h-3 w-3 mr-1" />
                {filter.label}
              </Badge>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/search/filters')}
            className="whitespace-nowrap"
          >
            <Filter className="h-3 w-3 mr-1" />
            Más filtros
          </Button>
        </div>
      )}

      {/* Panel de sugerencias y historial */}
      {isActive && (suggestions.length > 0 || searchHistory.length > 0 || query.length > 0) && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-50 max-h-96 overflow-y-auto">
          {/* Sugerencias de OpenAI */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">Sugerencias</div>
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={index}
                  suggestion={suggestion}
                  onClick={() => {
                    setQuery(suggestion.text);
                    performSearch(suggestion.text);
                  }}
                />
              ))}
            </div>
          )}

          {/* Loading state */}
          {isLoading && query.length > 2 && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Buscando sugerencias...</p>
            </div>
          )}

          {/* Historial de búsquedas */}
          {searchHistory.length > 0 && (
            <div className="p-2 border-t">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">Búsquedas recientes</div>
              {searchHistory.map((item, index) => (
                <HistoryItem
                  key={index}
                  text={item}
                  onClick={() => {
                    setQuery(item);
                    performSearch(item);
                  }}
                  onRemove={() => {
                    const newHistory = searchHistory.filter(h => h !== item);
                    setSearchHistory(newHistory);
                    localStorage.setItem(
                      `servimap_search_history_${user?.uid}`, 
                      JSON.stringify(newHistory)
                    );
                  }}
                />
              ))}
            </div>
          )}

          {/* Estado vacío */}
          {suggestions.length === 0 && searchHistory.length === 0 && !isLoading && query.length > 2 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se encontraron sugerencias</p>
              <p className="text-xs">Presiona Enter para buscar &quot;{query}&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente de sugerencia individual
function SuggestionItem({ suggestion, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
    >
      <div className="flex items-center space-x-3">
        <Search className="h-4 w-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium">{suggestion.text}</p>
          {suggestion.category && (
            <p className="text-xs text-gray-500">{suggestion.category}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// Componente de historial individual
function HistoryItem({ text, onClick, onRemove }) {
  return (
    <div className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-md group">
      <History className="h-4 w-4 text-gray-400" />
      <button
        onClick={onClick}
        className="flex-1 text-left text-sm"
      >
        {text}
      </button>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}