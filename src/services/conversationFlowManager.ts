import { ChatIntent, IntentParameters } from './intentClassificationService';
import { UnifiedConversationContext, ConversationTurn, ConversationContext } from './unifiedConversationContext';
import { CacheManager } from './cacheManager';

export interface ConversationSession {
  id: string;
  userId?: string;
  startTime: Date;
  lastActiveTime: Date;
  destination?: string;
  totalMessages: number;
  conversationPhases: string[];
  context: ConversationContext;
  isActive: boolean;
}

export interface ConversationAnalytics {
  totalSessions: number;
  averageSessionLength: number;
  commonIntents: { intent: string; count: number }[];
  popularDestinations: { destination: string; count: number }[];
  conversionRate: number; // % of sessions that led to itinerary creation
  userSatisfactionScore: number;
}

export interface ConversationFlowConfig {
  maxSessionHistory: number;
  sessionTimeoutMinutes: number;
  enableAnalytics: boolean;
  persistToDatabase: boolean;
  autoSaveInterval: number;
}

export class ConversationFlowManager {
  private static instance: ConversationFlowManager;
  private currentSession: ConversationSession | null = null;
  private sessionHistory: ConversationSession[] = [];
  private conversationContext: UnifiedConversationContext;
  private cacheManager: CacheManager;
  private config: ConversationFlowConfig;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private currentUserId: string | undefined = undefined;

  // Storage keys - will be user-specific
  private getStorageKeys(userId?: string) {
    const userSuffix = userId ? `_user_${userId}` : '';
    return {
      CURRENT_SESSION: `conversation_current_session${userSuffix}`,
      SESSION_HISTORY: `conversation_session_history${userSuffix}`,
      ANALYTICS: `conversation_analytics${userSuffix}`,
      CONTEXT: `conversation_context${userSuffix}`
    };
  }

  private constructor(config: Partial<ConversationFlowConfig> = {}) {
    this.config = {
      maxSessionHistory: 10,
      sessionTimeoutMinutes: 30,
      enableAnalytics: true,
      persistToDatabase: false,
      autoSaveInterval: 30000, // 30 seconds
      ...config
    };
    
    // Initialize cache manager first
    this.cacheManager = CacheManager.getInstance();
    
    // Initialize unified conversation context with cache manager
    this.conversationContext = new UnifiedConversationContext(this.cacheManager);
    this.initializeFromStorage();
    this.startAutoSaveTimer();
  }

  public static getInstance(config?: Partial<ConversationFlowConfig>): ConversationFlowManager {
    if (!ConversationFlowManager.instance) {
      ConversationFlowManager.instance = new ConversationFlowManager(config);
    }
    return ConversationFlowManager.instance;
  }

  /**
   * Initialize conversation flow manager from stored data
   */
  private initializeFromStorage(): void {
    try {
      const storageKeys = this.getStorageKeys(this.currentUserId);
      
      // Load current session
      const storedSession = localStorage.getItem(storageKeys.CURRENT_SESSION);
      if (storedSession) {
        const session = JSON.parse(storedSession);
        // Check if session is still active (not timed out)
        const lastActive = new Date(session.lastActiveTime);
        const timeSinceActive = Date.now() - lastActive.getTime();
        const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;
        
        if (timeSinceActive < timeoutMs) {
          this.currentSession = {
            ...session,
            startTime: new Date(session.startTime),
            lastActiveTime: new Date(session.lastActiveTime)
          };
        }
      }

      // Load session history
      const storedHistory = localStorage.getItem(storageKeys.SESSION_HISTORY);
      if (storedHistory) {
        this.sessionHistory = JSON.parse(storedHistory).map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          lastActiveTime: new Date(session.lastActiveTime)
        }));
      }

      // Load conversation context
      const storedContext = localStorage.getItem(storageKeys.CONTEXT);
      if (storedContext && this.currentSession) {
        const contextData = JSON.parse(storedContext);
        // Restore conversation context - unified context will handle cache loading automatically
        // We don't need to manually restore since the cache is handled internally
        if (contextData.conversationHistory && contextData.conversationHistory.length > 0) {
          console.log('Conversation context loaded from storage with', contextData.conversationHistory.length, 'turns');
        }
      }
    } catch (error) {
      console.error('Error initializing conversation flow manager from storage:', error);
    }
  }

  /**
   * Start a new conversation session
   */
  public startSession(userId?: string, destination?: string): ConversationSession {
    // If user has changed, clear previous user's data from memory (but not storage)
    if (this.currentUserId && userId && this.currentUserId !== userId) {
      console.log('User changed, clearing previous session data from memory');
      this.currentSession = null;
      this.sessionHistory = [];
      this.conversationContext.clearContext();
    }
    
    // Update current user ID
    this.currentUserId = userId;
    
    // Try to load existing session for this user
    if (userId) {
      this.initializeFromStorage();
      
      // If we found an existing active session for this user, return it
      if (this.currentSession && this.currentSession.isActive && this.currentSession.userId === userId) {
        console.log('Found existing active session for user:', userId);
        return this.currentSession;
      }
    }
    
    // End current session if exists
    if (this.currentSession) {
      this.endSession();
    }

    // Create new session
    this.currentSession = {
      id: this.generateSessionId(),
      userId,
      startTime: new Date(),
      lastActiveTime: new Date(),
      destination,
      totalMessages: 0,
      conversationPhases: ['greeting'],
      context: this.conversationContext.getContext(),
      isActive: true
    };

    // Reset conversation context
    this.conversationContext.clearContext();
    if (destination) {
      this.conversationContext.setCurrentDestination(destination);
    }

    this.saveToStorage();
    return this.currentSession;
  }

  /**
   * End the current conversation session
   */
  public endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.isActive = false;
    this.currentSession.lastActiveTime = new Date();

    // Add to session history
    this.sessionHistory.push({ ...this.currentSession });
    
    // Limit session history
    if (this.sessionHistory.length > this.config.maxSessionHistory) {
      this.sessionHistory = this.sessionHistory.slice(-this.config.maxSessionHistory);
    }

    this.currentSession = null;
    this.saveToStorage();
  }

  /**
   * Track a conversation turn (message)
   */
  public trackConversationTurn(
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters,
    confidence?: number
  ): void {
    // Ensure we have an active session
    if (!this.currentSession) {
      this.startSession();
    }

    if (!this.currentSession) return;

    // Update session
    this.currentSession.totalMessages++;
    this.currentSession.lastActiveTime = new Date();

    // Update destination if detected
    if (parameters?.destination || parameters?.location) {
      const destination = parameters.destination || parameters.location;
      if (!this.currentSession.destination) {
        this.currentSession.destination = destination;
      }
    }

    // Track conversation phases
    this.updateConversationPhase(intent, role);

    // Add to enhanced conversation context
    this.conversationContext.addConversationTurn(role, content, intent, parameters, confidence);

    // Update session context
    this.currentSession.context = this.conversationContext.getContext();

    this.saveToStorage();
  }

  /**
   * Update conversation phase based on intent and role
   */
  private updateConversationPhase(intent?: ChatIntent, role?: 'user' | 'assistant'): void {
    if (!this.currentSession || !intent) return;

    const currentPhase = this.currentSession.conversationPhases[this.currentSession.conversationPhases.length - 1];
    let newPhase: string | null = null;

    if (role === 'user') {
      switch (intent) {
        case ChatIntent.NEW_ITINERARY:
          newPhase = 'itinerary_planning';
          break;
        case ChatIntent.GET_RECOMMENDATIONS:
          newPhase = 'seeking_recommendations';
          break;
        case ChatIntent.MODIFY_EXISTING:
          newPhase = 'modifying_itinerary';
          break;
        case ChatIntent.ASK_QUESTIONS:
          newPhase = 'asking_questions';
          break;
        default:
          if (currentPhase === 'greeting') {
            newPhase = 'active_conversation';
          }
      }
    }

    if (newPhase && newPhase !== currentPhase) {
      this.currentSession.conversationPhases.push(newPhase);
    }
  }

  /**
   * Get current conversation session
   */
  public getCurrentSession(): ConversationSession | null {
    return this.currentSession;
  }

  /**
   * Get conversation context
   */
  public getConversationContext(): UnifiedConversationContext {
    return this.conversationContext;
  }

  /**
   * Get conversation analytics
   */
  public getAnalytics(): ConversationAnalytics {
    const allSessions = [...this.sessionHistory];
    if (this.currentSession) {
      allSessions.push(this.currentSession);
    }

    const totalSessions = allSessions.length;
    const averageSessionLength = totalSessions > 0 
      ? allSessions.reduce((sum, session) => sum + session.totalMessages, 0) / totalSessions
      : 0;

    // Collect intent counts
    const intentCounts: { [key: string]: number } = {};
    const destinationCounts: { [key: string]: number } = {};
    let itineraryCreationCount = 0;

    allSessions.forEach(session => {
      // Track destinations
      if (session.destination) {
        destinationCounts[session.destination] = (destinationCounts[session.destination] || 0) + 1;
      }

      // Track itinerary creation
      if (session.conversationPhases.includes('itinerary_planning')) {
        itineraryCreationCount++;
      }

      // Track intents from conversation history
      if (session.context?.conversationHistory) {
        session.context.conversationHistory.forEach(turn => {
          if (turn.intent) {
            const intentKey = turn.intent.toString();
            intentCounts[intentKey] = (intentCounts[intentKey] || 0) + 1;
          }
        });
      }
    });

    const commonIntents = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const popularDestinations = Object.entries(destinationCounts)
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const conversionRate = totalSessions > 0 ? (itineraryCreationCount / totalSessions) * 100 : 0;

    return {
      totalSessions,
      averageSessionLength,
      commonIntents,
      popularDestinations,
      conversionRate,
      userSatisfactionScore: 85 // Placeholder - could be calculated based on user feedback
    };
  }

  /**
   * Get conversation suggestions based on current context
   */
  public getContextualSuggestions(): string[] {
    return this.conversationContext.getContextualSuggestions();
  }

  /**
   * Check if current message should be handled as a follow-up
   */
  public isFollowUpQuestion(message: string): boolean {
    return this.conversationContext.isFollowUpQuestion(message);
  }

  /**
   * Get conversation history for the current session
   */
  public getConversationHistory(): ConversationTurn[] {
    return this.conversationContext.getRecentHistory(20); // Get last 20 turns
  }

  /**
   * Clear all conversation data
   */
  public clearAllData(): void {
    this.endSession();
    this.sessionHistory = [];
    this.conversationContext.clearContext();
    
    // Clear storage for current user
    Object.values(this.getStorageKeys(this.currentUserId)).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Clear conversation data for a specific user
   */
  public clearUserData(userId: string): void {
    // If clearing data for current user, also clear memory
    if (this.currentUserId === userId) {
      this.endSession();
      this.sessionHistory = [];
      this.conversationContext.clearContext();
    }
    
    // Clear storage for specific user
    Object.values(this.getStorageKeys(userId)).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Export conversation data for analysis or backup
   */
  public exportConversationData(): any {
    return {
      currentSession: this.currentSession,
      sessionHistory: this.sessionHistory,
      analytics: this.getAnalytics(),
      context: this.conversationContext.getContext(),
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Import conversation data from export
   */
  public importConversationData(data: any): void {
    try {
      if (data.sessionHistory) {
        this.sessionHistory = data.sessionHistory.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          lastActiveTime: new Date(session.lastActiveTime)
        }));
      }

      if (data.currentSession) {
        this.currentSession = {
          ...data.currentSession,
          startTime: new Date(data.currentSession.startTime),
          lastActiveTime: new Date(data.currentSession.lastActiveTime)
        };
      }

      this.saveToStorage();
    } catch (error) {
      console.error('Error importing conversation data:', error);
    }
  }

  /**
   * Save conversation state to localStorage
   */
  private saveToStorage(): void {
    try {
      const storageKeys = this.getStorageKeys(this.currentUserId);
      
      if (this.currentSession) {
        localStorage.setItem(storageKeys.CURRENT_SESSION, JSON.stringify(this.currentSession));
      }
      
      localStorage.setItem(storageKeys.SESSION_HISTORY, JSON.stringify(this.sessionHistory));
      localStorage.setItem(storageKeys.CONTEXT, JSON.stringify(this.conversationContext.getContext()));
    } catch (error) {
      console.error('Error saving conversation state to storage:', error);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      this.saveToStorage();
    }, this.config.autoSaveInterval);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    this.endSession();
    this.saveToStorage();
  }
}

// Export singleton instance getter
export const conversationFlowManager = ConversationFlowManager.getInstance(); 