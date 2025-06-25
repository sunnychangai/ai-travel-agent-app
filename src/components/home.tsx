import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Settings } from 'lucide-react';
import Onboarding from '../pages/Onboarding';
import TravelPlannerLayout from "./TravelPlanner/TravelPlannerLayout";

// Simplified header with My Trips link
const Header = () => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-2 pl-4">
          <Link to="/">
            <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold">AI Travel Planner</h1>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full ml-2">
                Beta
              </span>
            </div>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/my-trips" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            My Trips
          </Link>
          <button className="text-sm text-gray-600 hover:text-gray-900">
            Help
          </button>
          <button 
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Settings Modal - Onboarding Flow */}
      {showSettings && (
        <Onboarding onComplete={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default function Home() {
  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header />

      <main className="flex-1 overflow-hidden relative">
        <TravelPlannerLayout />
      </main>
    </div>
  );
}
