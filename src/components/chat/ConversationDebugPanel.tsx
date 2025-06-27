import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { conversationFlowManager } from '../../services/conversationFlowManager';
import useMessages from '../../hooks/useMessages';

export function ConversationDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);
  const { messages, getStoredMessageCount } = useMessages();

  const refreshDebugInfo = () => {
    const session = conversationFlowManager.getCurrentSession();
    const conversationHistory = conversationFlowManager.getConversationHistory();
    const context = conversationFlowManager.getConversationContext().getContext();
    const storedMessageCount = getStoredMessageCount();

    setDebugInfo({
      session,
      conversationHistory,
      context,
      uiMessages: messages,
      storedMessageCount,
      lastUpdated: new Date().toLocaleTimeString()
    });
  };

  useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  const handleClearAll = () => {
    conversationFlowManager.clearAllData();
    refreshDebugInfo();
  };

  const handleExportDebug = () => {
    const debugData = {
      ...debugInfo,
      localStorage: {
        chatMessages: localStorage.getItem('chat_messages_session'),
        conversationSession: localStorage.getItem('conversation_current_session'),
        conversationHistory: localStorage.getItem('conversation_session_history'),
        conversationContext: localStorage.getItem('conversation_context')
      }
    };

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
        >
          🐛 Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Conversation Debug</CardTitle>
            <div className="flex gap-1">
              <Button onClick={refreshDebugInfo} size="sm" variant="outline">
                🔄
              </Button>
              <Button onClick={handleExportDebug} size="sm" variant="outline">
                📋
              </Button>
              <Button onClick={handleClearAll} size="sm" variant="destructive">
                🗑️
              </Button>
              <Button onClick={() => setIsVisible(false)} size="sm" variant="ghost">
                ✕
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Last updated: {debugInfo.lastUpdated}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          <div>
            <div className="font-medium mb-1">Session Status</div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant={debugInfo.session?.isActive ? "default" : "secondary"}>
                {debugInfo.session?.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline">
                ID: {debugInfo.session?.id?.slice(-8) || 'None'}
              </Badge>
            </div>
          </div>

          <div>
            <div className="font-medium mb-1">Message Counts</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>UI Messages: {debugInfo.uiMessages?.length || 0}</div>
              <div>Stored: {debugInfo.storedMessageCount || 0}</div>
              <div>History: {debugInfo.conversationHistory?.length || 0}</div>
              <div>Total: {debugInfo.session?.totalMessages || 0}</div>
            </div>
          </div>

          <div>
            <div className="font-medium mb-1">Conversation Context</div>
            <div className="text-xs space-y-1">
              <div>Phase: {debugInfo.context?.state?.phase || 'Unknown'}</div>
              <div>Destination: {debugInfo.session?.destination || 'None'}</div>
              <div>Active Location: {debugInfo.context?.state?.activeLocation || 'None'}</div>
            </div>
          </div>

          <div>
            <div className="font-medium mb-1">Recent Messages</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {debugInfo.conversationHistory?.slice(-3).map((turn: any, index: number) => (
                <div key={index} className="text-xs p-1 bg-muted rounded">
                  <Badge variant={turn.role === 'user' ? 'default' : 'secondary'} className="text-xs mr-1">
                    {turn.role}
                  </Badge>
                  {turn.content.slice(0, 50)}...
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-medium mb-1">Sync Status</div>
            <div className="text-xs">
              {debugInfo.uiMessages?.length === debugInfo.conversationHistory?.length ? (
                <Badge variant="default">✓ In Sync</Badge>
              ) : (
                <Badge variant="destructive">⚠ Out of Sync</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConversationDebugPanel; 