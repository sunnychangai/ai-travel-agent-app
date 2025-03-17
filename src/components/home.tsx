import React, { useState, useCallback } from "react";
import TravelPlannerLayout from "./TravelPlanner/TravelPlannerLayout";

// Simplified header without auth
const Header = () => (
  <header className="flex items-center justify-between p-4 border-b bg-white">
    <div className="flex items-center space-x-2 pl-4">
      <h1 className="text-2xl font-bold">AI Travel Planner</h1>
      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
        Beta
      </span>
    </div>
    <div className="flex items-center space-x-4">
      <button className="text-sm text-gray-600 hover:text-gray-900">
        Help
      </button>
      <button className="text-sm text-gray-600 hover:text-gray-900">
        Settings
      </button>
    </div>
  </header>
);

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
