import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, MapPin, X } from 'lucide-react';
import { googleMapsService } from '../../services/googleMapsService';
import { cn } from '../../lib/utils';

interface LocationSearchInputProps {
  initialValue?: string;
  onLocationSelected: (location: { lat: number; lng: number }, address: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  initialValue = '',
  onLocationSelected,
  placeholder = 'Enter a location',
  className,
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialValue && initialValue !== searchQuery) {
      setSearchQuery(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    // Add click outside listener to close predictions
    const handleClickOutside = (event: MouseEvent) => {
      if (
        predictionsRef.current && 
        !predictionsRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowPredictions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch predictions when search query changes
  useEffect(() => {
    const fetchPredictions = async () => {
      if (searchQuery.length < 3) {
        setPredictions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await googleMapsService.getPlacePredictions(searchQuery);
        setPredictions(results);
        setShowPredictions(results.length > 0);
      } catch (error) {
        console.error('Error fetching predictions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchPredictions, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectPrediction = async (prediction: any) => {
    setSearchQuery(prediction.description);
    setShowPredictions(false);
    setIsLoading(true);

    try {
      const location = await googleMapsService.getPlaceFromId(prediction.place_id);
      onLocationSelected(location, prediction.description);
    } catch (error) {
      console.error('Error getting location from place ID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const location = await googleMapsService.geocodeAddress(searchQuery);
      onLocationSelected(location, searchQuery);
    } catch (error) {
      console.error('Error geocoding address:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPredictions([]);
    setShowPredictions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 3 && setPredictions.length > 0 && setShowPredictions(true)}
            className="pl-10 pr-10"
            disabled={disabled || isLoading}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={disabled || isLoading}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <Button type="submit" disabled={disabled || isLoading || !searchQuery.trim()}>
          <Search size={18} className="mr-2" />
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {/* Predictions dropdown */}
      {showPredictions && (
        <div 
          ref={predictionsRef}
          className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto border border-gray-200"
        >
          <ul className="py-1">
            {predictions.map((prediction) => (
              <li 
                key={prediction.place_id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleSelectPrediction(prediction)}
              >
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>{prediction.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}; 