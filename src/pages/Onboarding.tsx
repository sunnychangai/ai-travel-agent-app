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
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load existing preferences when component mounts
  useEffect(() => {
    const loadExistingPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: existingPrefs, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (existingPrefs && !error) {
            // Convert database format to component format
            // Map budget description back to budget ID for proper selection
            let budgetValue: string = String(existingPrefs.budget || '');
            if (budgetValue) {
              const budgetOption = BUDGET_OPTIONS.find(opt => opt.description === budgetValue);
              if (budgetOption) {
                budgetValue = budgetOption.description; // Keep description for proper matching
              }
            }
            
            setPreferences({
              name: (existingPrefs as any)?.name || '',
              travelStyle: (existingPrefs as any)?.travel_style || [],
              activities: (existingPrefs as any)?.activities || [],
              preferences: (existingPrefs as any)?.preferences || [],
              budget: budgetValue || '',
              dreamDestinations: (existingPrefs as any)?.dream_destinations || ''
            });
            console.log("Loaded existing preferences:", existingPrefs);
          }
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        // Continue with empty preferences if loading fails
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadExistingPreferences();
  }, []);

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
      
      // Create a payload with only the columns that exist in the database
      const payload: {
        user_id: string;
        name: string;
        travel_style: string[];
        budget: string;
        created_at: string;
        preferences?: string[];
      } = {
        user_id: user.id,
        name: preferences.name,
        travel_style: preferences.travelStyle,
        budget: preferences.budget || '',
        created_at: new Date().toISOString()
      };
      
      // Add preferences data if the column exists
      if (preferences.preferences && preferences.preferences.length > 0) {
        payload.preferences = preferences.preferences;
      }
      
      console.log("Saving user preferences:", payload);
      
      const { error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(`Failed to save preferences: ${error.message}`);
      }

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
      console.error("Error saving preferences:", error);
      toast({
        title: "Error saving preferences",
        description: error.message || "An unknown error occurred",
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
    // Find the budget option with matching id
    const selectedOption = BUDGET_OPTIONS.find(option => option.id === value);
    // Save the description instead of just the symbol
    const budgetDescription = selectedOption ? selectedOption.description : '';
    setPreferences(prev => ({ ...prev, budget: budgetDescription }));
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
          <div className="space-y-5">
            <Input
              id="name"
              placeholder="Enter your name"
              value={preferences.name}
              onChange={handleInputChange}
              className="bg-white/90 backdrop-blur-sm text-lg h-10 rounded-xl py-0 border-gray-400"
              aria-label="Your name"
            />
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <Select 
                value={preferences.travelStyle[0] || ''} 
                onValueChange={(value) => setPreferences({...preferences, travelStyle: [value]})}
              >
                <SelectTrigger id="travelStyle" className="bg-white/90 backdrop-blur-sm h-12 rounded-xl">
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
              <Input
                id="dreamDestinations"
                placeholder="Your dream destinations (e.g., Paris, Tokyo)"
                value={preferences.dreamDestinations}
                onChange={handleInputChange}
                className="bg-white/90 backdrop-blur-sm h-12 rounded-xl"
              />
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {ACTIVITY_OPTIONS.map((option) => (
                <div 
                  key={option.id} 
                  className={`
                    flex items-center justify-center p-2 rounded-xl cursor-pointer transition-all
                    ${preferences.activities.includes(option.id) 
                      ? 'bg-blue-50/90 border border-blue-500 shadow-sm' 
                      : 'bg-white/90 backdrop-blur-sm border border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => handleActivityChange(option.id)}
                >
                  <Checkbox
                    id={`activity-${option.id}`}
                    checked={preferences.activities.includes(option.id)}
                    onCheckedChange={() => handleActivityChange(option.id)}
                    className="sr-only"
                  />
                  <Label htmlFor={`activity-${option.id}`} className="cursor-pointer text-sm font-medium text-center">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {PREFERENCE_OPTIONS.map((option) => (
                <div 
                  key={option.id} 
                  className={`
                    flex items-center justify-center p-2 rounded-xl cursor-pointer transition-all
                    ${preferences.preferences.includes(option.id) 
                      ? 'bg-blue-50/90 border border-blue-500 shadow-sm' 
                      : 'bg-white/90 backdrop-blur-sm border border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => handlePreferenceChange(option.id)}
                >
                  <Checkbox
                    id={`pref-${option.id}`}
                    checked={preferences.preferences.includes(option.id)}
                    onCheckedChange={() => handlePreferenceChange(option.id)}
                    className="sr-only"
                  />
                  <Label htmlFor={`pref-${option.id}`} className="cursor-pointer text-sm font-medium text-center">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleBudgetChange(option.id)}
                  className={`
                    h-20 flex flex-col items-center justify-center rounded-xl border transition-all
                    ${preferences.budget === option.description 
                      ? 'border-blue-500 bg-blue-50/90 text-blue-700 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  <span className="text-xl font-bold">{option.label}</span>
                  <span className="text-xs text-gray-500 mt-1">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Show loading while fetching existing preferences
  if (loadingPreferences) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-pulse text-gray-600">Loading your preferences...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[460px] flex overflow-hidden rounded-2xl shadow-2xl">
        {/* Left side - Background image with text overlay */}
        <div className="w-2/5 relative hidden md:block">
          <div 
            className="absolute inset-0 bg-cover bg-center" 
            style={{ backgroundImage: `url(${BACKGROUND_IMAGES[step-1]})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 p-8 flex flex-col justify-end">
              <h2 className="text-3xl font-semibold text-white">
                {step === 1 ? 'Welcome' : STEP_TITLES[step-1]}
              </h2>
              <p className="text-white/90 text-base font-light leading-relaxed">
                {STEP_DESCRIPTIONS[step-1]}
              </p>
              
              {/* Circle navigation indicators */}
              <div className="flex justify-center gap-3 mt-6">
                {STEP_TITLES.map((title, i) => (
                  <button
                    key={i}
                    className={`rounded-full transition-all border border-white/80 
                      ${step === i+1 
                        ? 'bg-white w-3 h-3' 
                        : 'bg-transparent w-2.5 h-2.5 hover:bg-white/50'}
                    `}
                    onClick={() => i+1 < step && setStep(i+1)}
                    disabled={i+1 > step}
                    aria-current={step === i+1 ? 'step' : undefined}
                    aria-label={`Go to ${title} step`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form content */}
        <div className="w-full md:w-3/5 bg-white flex flex-col relative">
          <button 
            onClick={() => onComplete ? onComplete() : navigate('/app')} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            aria-label="Skip onboarding"
          >
            <X size={20} />
          </button>
          
          {/* Main content */}
          <div className="flex-1 px-8 overflow-y-auto flex flex-col justify-center pt-16">
            <div className="mb-2 text-center">
              <h2 className="text-2xl font-semibold text-gray-900">{step === 1 ? 'What should we call you?' : STEP_TITLES[step-1]}</h2>
              {step !== 1 && <p className="text-gray-500 text-sm mb-4">{STEP_DESCRIPTIONS[step-1]}</p>}
            </div>
            
            <div className="py-1">
              {renderStep()}
            </div>
          </div>
          
          {/* Footer with buttons */}
          <div className="p-6 border-t border-gray-100">
            <div className="flex justify-between">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="rounded-full px-6 py-1.5 text-sm font-medium"
                >
                  Back
                </Button>
              ) : <div></div>}
              <Button
                onClick={handleNext}
                disabled={loading}
                className="rounded-full px-6 py-1.5 text-sm font-medium bg-black hover:bg-gray-800"
              >
                {step === 5 ? (loading ? 'Saving...' : 'Finish') : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 