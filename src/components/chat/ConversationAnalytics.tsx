import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import useConversationFlow from '../../hooks/useConversationFlow';

export function ConversationAnalytics() {
  const { 
    analytics, 
    currentSession, 
    conversationHistory, 
    exportConversationData, 
    clearAllData 
  } = useConversationFlow();
  
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = exportConversationData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting conversation data:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all conversation data? This cannot be undone.')) {
      clearAllData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Conversation Analytics</h2>
        <div className="space-x-2">
          <Button 
            onClick={handleExportData} 
            disabled={isExporting}
            variant="outline"
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </Button>
          <Button 
            onClick={handleClearData}
            variant="destructive"
          >
            Clear Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="session">Current Session</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalSessions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session Length</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.averageSessionLength.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">messages per session</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">sessions with itinerary</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.userSatisfactionScore}</div>
                <Progress value={analytics.userSatisfactionScore} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Common Intents</CardTitle>
                <CardDescription>Most frequent user intentions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.commonIntents.slice(0, 5).map((intent, index) => (
                    <div key={intent.intent} className="flex items-center justify-between">
                      <Badge variant="secondary" className="capitalize">
                        {intent.intent.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{intent.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Destinations</CardTitle>
                <CardDescription>Most discussed locations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.popularDestinations.slice(0, 5).map((destination, index) => (
                    <div key={destination.destination} className="flex items-center justify-between">
                      <Badge variant="outline">
                        {destination.destination}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{destination.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="session" className="space-y-4">
          {currentSession ? (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Session</CardTitle>
                  <CardDescription>
                    Started {new Date(currentSession.startTime).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Session ID:</span>
                      <span className="font-mono text-sm">{currentSession.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Total Messages:</span>
                      <span>{currentSession.totalMessages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Destination:</span>
                      <span>{currentSession.destination || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <Badge variant={currentSession.isActive ? "default" : "secondary"}>
                        {currentSession.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversation Phases</CardTitle>
                  <CardDescription>Journey through this session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {currentSession.conversationPhases.map((phase, index) => (
                      <Badge key={index} variant="outline" className="capitalize">
                        {phase.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No active session</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Conversation History</CardTitle>
              <CardDescription>Last {conversationHistory.length} messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversationHistory.map((turn, index) => (
                  <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant={turn.role === 'user' ? 'default' : 'secondary'}>
                      {turn.role}
                    </Badge>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{turn.content.slice(0, 200)}...</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{new Date(turn.timestamp).toLocaleTimeString()}</span>
                        {turn.intent && (
                          <Badge variant="outline" className="text-xs">
                            {turn.intent.toString().replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        )}
                        {turn.confidence && (
                          <span>Confidence: {(turn.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ConversationAnalytics; 