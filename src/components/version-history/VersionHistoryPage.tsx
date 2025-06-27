import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Clock, Package, Bug, Wrench, Sparkles, Target, Settings, Database } from 'lucide-react';
import { versionHistoryService, VersionEntry } from '../../services/versionHistoryService';

const VersionHistoryPage: React.FC = () => {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVersionHistory();
  }, []);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const versionData = await versionHistoryService.getVersionHistory();
      setVersions(versionData);
      setError(null);
    } catch (err) {
      setError('Failed to load version history');
      console.error('Error loading version history:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBulletPoint = (text: string, index: number) => {
    // Handle bold text in markdown format
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <li key={index} className="text-sm text-gray-600 leading-relaxed">
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={partIndex} className="text-gray-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </li>
    );
  };

  const renderSection = (title: string, items: string[], icon: React.ReactNode, color: string) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className={`font-medium text-sm ${color}`}>{title}</h4>
        </div>
        <ul className="space-y-1 ml-6">
          {items.map((item, index) => renderBulletPoint(item, index))}
        </ul>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Package className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Version History</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={loadVersionHistory}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Package className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Version History</h1>
        </div>
        <p className="text-gray-600">
          Track all the latest updates, improvements, and bug fixes to AI Travel Agent.
        </p>
      </div>

      <div className="space-y-6">
        {versions.map((version, index) => (
          <Card key={version.version} className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm font-mono">
                    v{version.version}
                  </Badge>
                  {index === 0 && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Latest
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  {version.date}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {renderSection(
                'Major Architecture Overhaul',
                version.architectureOverhaul,
                <Target className="h-4 w-4 text-purple-600" />,
                'text-purple-700'
              )}

              {renderSection(
                'New Features',
                version.features,
                <Sparkles className="h-4 w-4 text-green-600" />,
                'text-green-700'
              )}
              
              {renderSection(
                'Bug Fixes',
                version.bugFixes,
                <Bug className="h-4 w-4 text-red-600" />,
                'text-red-700'
              )}
              
              {renderSection(
                'Improvements',
                version.improvements,
                <Wrench className="h-4 w-4 text-blue-600" />,
                'text-blue-700'
              )}

              {renderSection(
                'Technical Debt Reduction',
                version.technicalDebtReduction,
                <Settings className="h-4 w-4 text-orange-600" />,
                'text-orange-700'
              )}

              {renderSection(
                'System Architecture',
                version.systemArchitecture,
                <Database className="h-4 w-4 text-teal-600" />,
                'text-teal-700'
              )}
            </CardContent>
            
            {index < versions.length - 1 && (
              <div className="px-6 pb-6">
                <Separator />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-2">How to Update Version History</h3>
        <p className="text-sm text-gray-600">
          To add new version information, edit the <code className="bg-gray-200 px-1 rounded">version-history.md</code> file 
          in the project root. The app will automatically load and display your changes.
        </p>
      </div>
    </div>
  );
};

export default VersionHistoryPage; 