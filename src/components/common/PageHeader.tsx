import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import Onboarding from '../../pages/Onboarding';

type PageHeaderProps = {
  title: string;
  showBetaBadge?: boolean;
};

const PageHeader: React.FC<PageHeaderProps> = ({ title, showBetaBadge = false }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {showBetaBadge && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Beta
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
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
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=user123"
              alt="User avatar"
              className="w-8 h-8 rounded-full"
            />
          </div>
        </div>
      </header>

      {/* Settings Modal - Onboarding Flow */}
      {showSettings && (
        <Onboarding onComplete={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default PageHeader; 