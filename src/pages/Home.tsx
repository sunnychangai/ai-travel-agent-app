import React from 'react';
import TravelPlannerLayout from '../components/TravelPlanner/TravelPlannerLayout';
import { ItineraryProvider } from '../contexts/ItineraryContext';
import PageHeader from '../components/common/PageHeader';
import PageFooter from '../components/common/PageFooter';

export default function Home() {
  return (
    <ItineraryProvider>
      <div className="flex flex-col h-screen w-full bg-background">
        <PageHeader title="AI Travel Agent" showBetaBadge={true} />
        
        <main className="flex-1 overflow-hidden">
          <TravelPlannerLayout />
        </main>
        
        <PageFooter />
      </div>
    </ItineraryProvider>
  );
} 