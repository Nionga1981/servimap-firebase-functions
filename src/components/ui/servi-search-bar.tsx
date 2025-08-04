// ServiSearchBar - Material Design 3 Search Component for ServiMap
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Search, 
  MapPin, 
  Mic, 
  X, 
  Clock,
  TrendingUp,
  Filter,
  Navigation
} from 'lucide-react';
import { ServiButton } from './servi-button';

interface ServiSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  recentSearches?: string[];
  trendingSearches?: string[];
  location?: boolean;
  voice?: boolean;
  filter?: boolean;
  variant?: 'standard' | 'docked' | 'full';
  className?: string;
  onLocationClick?: () => void;
  onVoiceClick?: () => void;
  onFilterClick?: () => void;
}

export const ServiSearchBar: React.FC<ServiSearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Buscar servicios profesionales...",
  suggestions = [],
  recentSearches = [],
  trendingSearches = [],
  location = true,
  voice = true,
  filter = false,
  variant = 'standard',
  className,
  onLocationClick,
  onVoiceClick,
  onFilterClick
}) => {
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show suggestions when focused or typing
  useEffect(() => {
    if (focused || value.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [focused, value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    onSearch(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleVoiceSearch = () => {
    if (onVoiceClick) {
      onVoiceClick();
    } else {
      // Built-in voice search with Web Speech API
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onChange(transcript);
          onSearch(transcript);
        };
        
        recognition.start();
      }
    }
  };

  // Base styles for different variants
  const containerStyles = {
    standard: 'w-full max-w-2xl mx-auto',
    docked: 'w-full',
    full: 'fixed inset-0 z-50 bg-white p-4'
  };

  const searchBarStyles = {
    standard: cn(
      'flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-full transition-all duration-200',
      focused && 'shadow-md ring-2 ring-[#209ded]/20 bg-white'
    ),
    docked: cn(
      'flex items-center gap-3 px-4 py-2 bg-white rounded-lg shadow-sm transition-all duration-200',
      focused && 'shadow-md ring-2 ring-[#209ded]/20'
    ),
    full: 'flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-full'
  };

  // Filtered suggestions based on input
  const filteredSuggestions = suggestions.filter(s => 
    s.toLowerCase().includes(value.toLowerCase())
  );

  const showRecentSearches = recentSearches.length > 0 && !value;
  const showTrendingSearches = trendingSearches.length > 0 && !value;
  const showFilteredSuggestions = filteredSuggestions.length > 0 && value;

  return (
    <div ref={containerRef} className={cn(containerStyles[variant], className)}>
      <form onSubmit={handleSubmit}>
        <div className={searchBarStyles[variant]}>
          {/* Back button for full variant */}
          {variant === 'full' && (
            <button
              type="button"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setFocused(false)}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {/* Search Icon */}
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          
          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-500 text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Clear button */}
            {value && (
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                onClick={handleClear}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}

            {/* Location button */}
            {location && (
              <button
                type="button"
                className="p-2 hover:bg-[#209ded]/10 rounded-full transition-colors"
                onClick={onLocationClick}
                title="Usar mi ubicación"
              >
                <MapPin className="w-5 h-5 text-[#209ded]" />
              </button>
            )}
            
            {/* Voice search button */}
            {voice && (
              <button
                type="button"
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "hover:bg-[#209ded]/10"
                )}
                onClick={handleVoiceSearch}
                title="Búsqueda por voz"
              >
                <Mic className={cn(
                  "w-5 h-5",
                  isListening ? "text-white" : "text-[#209ded]"
                )} />
              </button>
            )}

            {/* Filter button */}
            {filter && (
              <button
                type="button"
                className="p-2 hover:bg-[#209ded]/10 rounded-full transition-colors"
                onClick={onFilterClick}
                title="Filtros"
              >
                <Filter className="w-5 h-5 text-[#209ded]" />
              </button>
            )}
          </div>
        </div>
      </form>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (showRecentSearches || showTrendingSearches || showFilteredSuggestions) && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-gray-500">
                Búsquedas recientes
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={`recent-${index}`}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3"
                  onClick={() => handleSuggestionClick(search)}
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Trending Searches */}
          {showTrendingSearches && (
            <div className="p-2 border-t border-gray-100">
              <div className="px-3 py-2 text-sm font-medium text-gray-500">
                Tendencias
              </div>
              {trendingSearches.map((search, index) => (
                <button
                  key={`trending-${index}`}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3"
                  onClick={() => handleSuggestionClick(search)}
                >
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Filtered Suggestions */}
          {showFilteredSuggestions && (
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-gray-500">
                Sugerencias
              </div>
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">
                    {suggestion.split(new RegExp(`(${value})`, 'gi')).map((part, i) => (
                      <span key={i}>
                        {part.toLowerCase() === value.toLowerCase() ? (
                          <strong className="text-[#209ded]">{part}</strong>
                        ) : (
                          part
                        )}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Use My Location Option */}
          {location && !value && (
            <div className="p-2 border-t border-gray-100">
              <button
                className="w-full px-3 py-2 text-left hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-3"
                onClick={onLocationClick}
              >
                <Navigation className="w-4 h-4 text-[#209ded]" />
                <span className="text-[#209ded] font-medium">
                  Usar mi ubicación actual
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export search bar variants for different use cases
export const ServiSearchBarVariants = {
  Standard: ServiSearchBar,
  
  // Minimal search for headers
  Minimal: (props: Omit<ServiSearchBarProps, 'variant'>) => (
    <ServiSearchBar {...props} variant="docked" location={false} voice={false} />
  ),
  
  // Full screen search for mobile
  FullScreen: (props: Omit<ServiSearchBarProps, 'variant'>) => (
    <ServiSearchBar {...props} variant="full" />
  )
};