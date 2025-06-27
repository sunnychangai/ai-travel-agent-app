import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Settings, Menu, HelpCircle, MapPin, MessageSquare, Package } from 'lucide-react';
import Onboarding from '../pages/Onboarding';
import FeedbackPage from './feedback/FeedbackPage';
import VersionHistoryPage from './version-history/VersionHistoryPage';
import MyTripsPage from '../pages/MyTrips';
import TravelPlannerLayout from "./TravelPlanner/TravelPlannerLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// Simplified header with dropdown menu
const Header = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showMyTrips, setShowMyTrips] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center pl-2">
          <Link to="/">
            <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-xl font-bold mr-2">AI Travel Agent</h1>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                Beta
              </span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Feedback Button - Only show on desktop */}
          <div className="hidden md:block">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFeedback(true)}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                className="flex items-center"
                onClick={() => setShowMyTrips(true)}
              >
                <MapPin className="h-4 w-4 mr-2" />
                My Trips
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center"
                onClick={() => setShowVersionHistory(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Version History
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center">
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Settings Modal - Onboarding Flow */}
      {showSettings && (
        <Onboarding onComplete={() => setShowSettings(false)} />
      )}

      {/* Feedback Modal - Only for desktop */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Beta Feedback
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
            <FeedbackPage onClose={() => setShowFeedback(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Version History
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
            <VersionHistoryPage />
          </div>
        </DialogContent>
      </Dialog>

      {/* My Trips Modal */}
      <Dialog open={showMyTrips} onOpenChange={setShowMyTrips}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              My Trips
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
            <MyTripsPage onClose={() => setShowMyTrips(false)} />
          </div>
        </DialogContent>
      </Dialog>
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
