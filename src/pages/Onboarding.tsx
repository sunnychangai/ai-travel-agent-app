import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { X, Plane, MapPin } from 'lucide-react';

// Define props interface
interface OnboardingProps {
  onComplete?: () => void;
}

// Define the user preferences type
interface UserPreferences {
  name: string;
  travelStyle: string[];
  activities: string[];
  preferences: string[];
  budget: string;
  dreamDestinations?: string;
}

// Travel style options
const TRAVEL_STYLE_OPTIONS = [
  { id: 'luxury', label: 'Luxury' },
  { id: 'budget', label: 'Budget-friendly' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'relaxation', label: 'Relaxation' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'eco', label: 'Eco-friendly' }
];

// Activity options
const ACTIVITY_OPTIONS = [
  { id: 'sightseeing', label: 'Sightseeing' },
  { id: 'food', label: 'Food & Dining' },
  { id: 'relaxation', label: 'Relaxation & Wellness' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'museums', label: 'Museums & Culture' },
  { id: 'adventure', label: 'Adventure & Outdoors' },
  { id: 'nightlife', label: 'Nightlife & Entertainment' },
  { id: 'local', label: 'Local Experiences' }
];

// Preference options
const PREFERENCE_OPTIONS = [
  { id: 'popular', label: 'Popular attractions' },
  { id: 'hidden', label: 'Hidden gems' },
  { id: 'local', label: 'Local cuisine' },
  { id: 'international', label: 'International cuisine' },
  { id: 'public', label: 'Public transportation' },
  { id: 'private', label: 'Private transportation' },
  { id: 'guided', label: 'Guided tours' },
  { id: 'self', label: 'Self-guided exploration' }
];

// Budget options
const BUDGET_OPTIONS = [
  { id: '$', label: '$', description: 'Budget-friendly options' },
  { id: '$$', label: '$$', description: 'Mid-range options' },
  { id: '$$$', label: '$$$', description: 'High-end options' },
  { id: '$$$$', label: '$$$$', description: 'Luxury experiences' }
];

// Background images for each step
const BACKGROUND_IMAGES = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1935&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1770&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1770&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?q=80&w=1770&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1788&auto=format&fit=crop'
];

// Step titles
const STEP_TITLES = [
  'Profile',
  'Travel Style',
  'Activities',
  'Preferences',
  'Budget'
];

// Step descriptions for sidebar
const STEP_DESCRIPTIONS = [
  'Tell us about your travel preferences',
  'How do you like to experience new places?',
  'What do you enjoy doing while traveling?',
  'What matters most to you when traveling?',
  'What\'s your typical travel budget?'
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: '',
    travelStyle: [],
    activities: [],
    preferences: [],
    budget: '',
    dreamDestinations: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Generic handler for updating array-based preferences
  const handleArrayPreferenceChange = (field: keyof UserPreferences, id: string) => {
    setPreferences(prev => {
      const currentValues = prev[field] as string[];
      const newValues = currentValues.includes(id)
        ? currentValues.filter(item => item !== id)
        : [...currentValues, id];
      
      return { ...prev, [field]: newValues };
    });
  };

  // Generic handler for updating string-based preferences
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setPreferences(prev => ({ ...prev, [id]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !preferences.name) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }
    
    if (step === 5) {
      savePreferences();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const savePreferences = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          name: preferences.name,
          travel_style: preferences.travelStyle,
          activities: preferences.activities,
          preferences: preferences.preferences,
          budget: preferences.budget,
          dream_destinations: preferences.dreamDestinations,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your travel preferences have been saved successfully.",
      });
      
      // Call onComplete if provided, otherwise navigate
      if (onComplete) {
        onComplete();
      } else {
        navigate('/app');
      }
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Refactored handlers
  const handleTravelStyleChange = (id: string) => {
    handleArrayPreferenceChange('travelStyle', id);
  };

  const handleActivityChange = (id: string) => {
    handleArrayPreferenceChange('activities', id);
  };

  const handlePreferenceChange = (id: string) => {
    handleArrayPreferenceChange('preferences', id);
  };

  const handleBudgetChange = (value: string) => {
    setPreferences(prev => ({ ...prev, budget: value }));
  };

  // Prevent scrolling on the background when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Render the appropriate step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 px-2">
            <div>
              <h2 className="text-2xl font-bold">Welcome to AI Travel Assistant</h2>
              <p className="text-gray-500 mt-2">Let's get to know you better to personalize your experience.</p>
            </div>
            <div className="space-y-4">
              <Label htmlFor="name">What's your name?</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={preferences.name}
                onChange={handleInputChange}
                className="bg-white/80 backdrop-blur-sm"
              />
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 px-2">
            <div>
              <h2 className="text-2xl font-bold">Travel Style</h2>
              <p className="text-gray-500 mt-2">Tell us how you like to travel.</p>
            </div>
            <div className="space-y-4">
              <div className="mb-4">
                <Label htmlFor="travelStyle">What's your travel style?</Label>
                <Select 
                  value={preferences.travelStyle[0] || ''} 
                  onValueChange={(value) => setPreferences({...preferences, travelStyle: [value]})}
                >
                  <SelectTrigger id="travelStyle" className="bg-white/80 backdrop-blur-sm">
                    <SelectValue placeholder="Select your travel style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">⚖️ Balanced Mix</SelectItem>
                    <SelectItem value="luxury">✨ Luxury</SelectItem>
                    <SelectItem value="budget">💰 Budget-friendly</SelectItem>
                    <SelectItem value="adventure">🧗‍♂️ Adventure</SelectItem>
                    <SelectItem value="relaxation">🧘‍♀️ Relaxation</SelectItem>
                    <SelectItem value="cultural">🏛️ Cultural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="dreamDestinations">Favorite or dream destinations</Label>
                <Input
                  id="dreamDestinations"
                  placeholder="E.g., Paris, Tokyo, New York (comma separated)"
                  value={preferences.dreamDestinations}
                  onChange={handleInputChange}
                  className="bg-white/80 backdrop-blur-sm"
                />
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6 px-2">
            <div>
              <h2 className="text-2xl font-bold">Activity Interests</h2>
              <p className="text-gray-500 mt-2">What activities do you enjoy while traveling?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {ACTIVITY_OPTIONS.map((option) => (
                <div 
                  key={option.id} 
                  className={`
                    flex items-center space-x-2 p-3 rounded-xl cursor-pointer transition-all
                    ${preferences.activities.includes(option.id) 
                      ? 'bg-blue-50 border-2 border-blue-500' 
                      : 'bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => handleActivityChange(option.id)}
                >
                  <Checkbox
                    id={`activity-${option.id}`}
                    checked={preferences.activities.includes(option.id)}
                    onCheckedChange={() => handleActivityChange(option.id)}
                    className="sr-only"
                  />
                  <Label htmlFor={`activity-${option.id}`} className="cursor-pointer flex-1">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6 px-2">
            <div>
              <h2 className="text-2xl font-bold">Travel Preferences</h2>
              <p className="text-gray-500 mt-2">Select your preferences for a better travel experience.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {PREFERENCE_OPTIONS.map((option) => (
                <div 
                  key={option.id} 
                  className={`
                    flex items-center space-x-2 p-3 rounded-xl cursor-pointer transition-all
                    ${preferences.preferences.includes(option.id) 
                      ? 'bg-blue-50 border-2 border-blue-500' 
                      : 'bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => handlePreferenceChange(option.id)}
                >
                  <Checkbox
                    id={`pref-${option.id}`}
                    checked={preferences.preferences.includes(option.id)}
                    onCheckedChange={() => handlePreferenceChange(option.id)}
                    className="sr-only"
                  />
                  <Label htmlFor={`pref-${option.id}`} className="cursor-pointer flex-1">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-6 px-2">
            <div>
              <h2 className="text-2xl font-bold">Travel Budget</h2>
              <p className="text-gray-500 mt-2">What's your typical budget for travel experiences?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleBudgetChange(option.id)}
                  className={`
                    h-24 flex flex-col items-center justify-center rounded-xl border-2 transition-all
                    ${preferences.budget === option.id 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  <span className="text-2xl font-bold mb-1">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[600px] flex overflow-hidden rounded-3xl shadow-2xl">
        {/* Left side - Background image with text overlay */}
        <div className="w-2/5 relative hidden md:block">
          <div 
            className="absolute inset-0 bg-cover bg-center" 
            style={{ backgroundImage: `url(${BACKGROUND_IMAGES[step-1]})` }}
          >
            <div className="absolute inset-0 bg-black/30 p-8 flex flex-col justify-end">
              <h2 className="text-3xl font-bold text-white mb-2">
                {step === 1 ? 'Welcome' : STEP_TITLES[step-1]}
              </h2>
              <p className="text-white/80 text-lg">
                {STEP_DESCRIPTIONS[step-1]}
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Form content */}
        <div className="w-full md:w-3/5 bg-white p-8 px-12 relative">
          <button 
            onClick={() => onComplete ? onComplete() : navigate('/app')} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Skip onboarding"
          >
            <X size={20} />
          </button>
          
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">{STEP_TITLES[step-1]}</h1>
              <div className="text-sm text-gray-500">Step {step} of 5</div>
            </div>
            
            {/* Navigation tabs */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {STEP_TITLES.map((title, i) => (
                <button
                  key={i}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                    step === i+1 
                      ? 'bg-gray-900 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => i+1 < step && setStep(i+1)}
                  disabled={i+1 > step}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[350px] overflow-y-auto pr-2 pl-4">
            {renderStep()}
          </div>
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="rounded-full px-6"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={loading}
              className="rounded-full px-6 bg-black hover:bg-gray-800"
            >
              {step === 5 ? (loading ? 'Saving...' : 'Finish') : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 