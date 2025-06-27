import { ChatIntent, IntentParameters } from './intentClassificationService';
import { CacheManager, CacheEvent } from './cacheManager';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  parameters?: IntentParameters;
  confidence?: number;
  followUpTo?: string; // ID of the turn this is following up to
}

export interface ConversationState {
  phase: 'greeting' | 'destination_planning' | 'recommendation_seeking' | 'itinerary_building' | 'follow_up' | 'general';
  activeLocation?: string;
  activeRecommendationType?: 'restaurants' | 'activities' | 'hotels' | 'general';
  lastRecommendationTimestamp?: Date;
  awaitingFollowUp: boolean;
  conversationFlow: string[]; // Track the flow of conversation
}

export interface ConversationContext {
  currentDestination?: string;
  currentTopic?: string;
  state: ConversationState;
  recentRecommendations: {
    type: string;
    location: string;
    items: string[];
    timestamp: Date;
    query: string; // Original user query
  }[];
  mentionedPreferences: {
    [key: string]: {
      value: string;
      timestamp: Date;
    };
  };
  conversationHistory: ConversationTurn[];
  lastIntent?: ChatIntent;
  lastParameters?: IntentParameters;
  pendingQuestions: string[]; // Questions the agent could ask for follow-up
  createdAt: Date;
  lastUpdated: Date;
  version: number; // For context versioning and migration
}

export class UnifiedConversationContext {
  private context: ConversationContext;
  private readonly maxHistoryLength: number;
  private readonly maxRecommendations: number;
  private readonly cacheManager: CacheManager;
  private readonly cacheNamespace = 'conversation-context';
  private readonly conversationTtl = 3600000; // 1 hour

  constructor(
    cacheManager: CacheManager, 
    maxHistoryLength = 15, 
    maxRecommendations = 10
  ) {
    this.maxHistoryLength = maxHistoryLength;
    this.maxRecommendations = maxRecommendations;
    this.cacheManager = cacheManager;
    this.context = this.initializeContext();

    // Register the cache namespace with proper configuration
    this.cacheManager.registerCache({
      namespace: this.cacheNamespace,
      ttl: this.conversationTtl,
      userScoped: true,
      persistence: true,
      maxSize: 50 // Maximum number of cached conversation contexts
    });

    // Register for destination change events to clear context
    this.cacheManager.addEventListener(CacheEvent.DESTINATION_CHANGE, (data: any) => {
      this.clearContext();
    });

    // Load existing context from cache if available
    this.loadFromCache();
  }

  /**
   * Initialize a new conversation context
   */
  private initializeContext(): ConversationContext {
    const now = new Date();
    return {
      state: {
        phase: 'greeting',
        awaitingFollowUp: false,
        conversationFlow: []
      },
      recentRecommendations: [],
      mentionedPreferences: {},
      conversationHistory: [],
      pendingQuestions: [],
      createdAt: now,
      lastUpdated: now,
      version: 1
    };
  }

  /**
   * Load conversation context from cache
   */
  private loadFromCache(): void {
    try {
      const cachedContext = this.cacheManager.get(this.cacheNamespace, 'current-context') as ConversationContext | null;
      if (cachedContext && this.isValidContext(cachedContext)) {
        this.context = {
          ...cachedContext,
          // Ensure dates are properly restored
          createdAt: new Date(cachedContext.createdAt),
          lastUpdated: new Date(cachedContext.lastUpdated),
          conversationHistory: (cachedContext.conversationHistory || []).map((turn: any) => ({
            ...turn,
            timestamp: new Date(turn.timestamp)
          })),
          recentRecommendations: (cachedContext.recentRecommendations || []).map((rec: any) => ({
            ...rec,
            timestamp: new Date(rec.timestamp)
          })),
          mentionedPreferences: Object.fromEntries(
            Object.entries(cachedContext.mentionedPreferences || {}).map(([key, pref]: [string, any]) => [
              key,
              { ...pref, timestamp: new Date(pref.timestamp) }
            ])
          ),
          state: cachedContext.state || {
            phase: 'greeting',
            awaitingFollowUp: false,
            conversationFlow: []
          },
          pendingQuestions: cachedContext.pendingQuestions || [],
          version: cachedContext.version || 1
        };
      }
    } catch (error) {
      console.warn('Failed to load conversation context from cache:', error);
      // Fall back to new context
      this.context = this.initializeContext();
    }
  }

  /**
   * Validate cached context structure and age
   */
  private isValidContext(context: any): boolean {
    if (!context || typeof context !== 'object') return false;
    
    // Check required fields
    const requiredFields = ['state', 'conversationHistory', 'createdAt', 'version'];
    if (!requiredFields.every(field => field in context)) return false;

    // Check if context is too old (older than 24 hours)
    const contextAge = Date.now() - new Date(context.createdAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (contextAge > maxAge) return false;

    // Check version compatibility (for future migrations)
    if (context.version > 1) {
      console.warn('Conversation context version not supported:', context.version);
      return false;
    }

    return true;
  }

  /**
   * Save conversation context to cache
   */
  private saveToCache(): void {
    try {
      this.context.lastUpdated = new Date();
      this.cacheManager.set(this.cacheNamespace, 'current-context', this.context);
      
      // Also save a backup with timestamp for debugging
      const timestamp = Date.now();
      this.cacheManager.set(this.cacheNamespace, `backup-${timestamp}`, this.context);
    } catch (error) {
      console.error('Failed to save conversation context to cache:', error);
    }
  }

  /**
   * Add a new turn to the conversation history with enhanced context tracking
   */
  addConversationTurn(
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters,
    confidence?: number
  ): string {
    const turnId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const turn: ConversationTurn = {
      id: turnId,
      role,
      content,
      timestamp: new Date(),
      intent,
      parameters,
      confidence,
    };

    // Detect if this is a follow-up to a previous turn
    if (role === 'user' && this.isFollowUpQuestion(content)) {
      const recentAssistantTurn = this.getLastAssistantTurn();
      if (recentAssistantTurn) {
        turn.followUpTo = recentAssistantTurn.id;
      }
    }

    this.context.conversationHistory.push(turn);
    
    // Maintain history length limit
    if (this.context.conversationHistory.length > this.maxHistoryLength) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-this.maxHistoryLength);
    }

    // Update conversation state based on the turn
    this.updateConversationState(turn);

    // Update last intent and parameters for user turns
    if (role === 'user' && intent) {
      this.context.lastIntent = intent;
      this.context.lastParameters = parameters;
    }

    // Update current destination if present in parameters
    if (parameters?.location || parameters?.destination) {
      const location = parameters.location || parameters.destination;
      if (location) {
        this.setCurrentDestination(location);
      }
    }

    // Track recommendations if present
    if (role === 'assistant' && intent === ChatIntent.GET_RECOMMENDATIONS) {
      this.addRecommendation(
        parameters?.recommendationType || 'general',
        parameters?.location || this.context.currentDestination || 'Unknown',
        content,
        this.getLastUserMessage() || content
      );
    }

    // Update conversation flow
    if (intent) {
      this.context.state.conversationFlow.push(intent);
      // Keep only last 5 flow steps
      if (this.context.state.conversationFlow.length > 5) {
        this.context.state.conversationFlow = this.context.state.conversationFlow.slice(-5);
      }
    }

    // Save to cache after updates
    this.saveToCache();

    return turnId;
  }

  /**
   * Update conversation state based on the current turn
   */
  private updateConversationState(turn: ConversationTurn): void {
    const { intent, role } = turn;

    if (role === 'user') {
      switch (intent) {
        case ChatIntent.NEW_ITINERARY:
          this.context.state.phase = 'itinerary_building';
          this.context.state.awaitingFollowUp = false;
          break;
        case ChatIntent.GET_RECOMMENDATIONS:
          this.context.state.phase = 'recommendation_seeking';
          this.context.state.activeRecommendationType = turn.parameters?.recommendationType as any;
          this.context.state.awaitingFollowUp = true;
          break;
        case ChatIntent.GENERAL_CHAT:
          if (this.isFollowUpQuestion(turn.content)) {
            this.context.state.phase = 'follow_up';
          } else {
            this.context.state.phase = 'general';
            this.context.state.awaitingFollowUp = false;
          }
          break;
        default:
          this.context.state.awaitingFollowUp = false;
      }
    } else {
      // Assistant turn
      if (intent === ChatIntent.GET_RECOMMENDATIONS) {
        this.context.state.lastRecommendationTimestamp = new Date();
        this.context.state.awaitingFollowUp = true;
        
        // Generate pending questions for follow-up
        this.generatePendingQuestions(turn.parameters?.recommendationType, this.context.state.activeLocation);
      }
    }
  }

  /**
   * Get the last user message content
   */
  private getLastUserMessage(): string | undefined {
    const lastUserTurn = this.context.conversationHistory
      .slice()
      .reverse()
      .find(turn => turn.role === 'user');
    return lastUserTurn?.content;
  }

  /**
   * Enhanced recommendation tracking
   */
  private addRecommendation(type: string, location: string, content: string, query: string): void {
    const items = this.extractRecommendationItems(content);

    if (items.length > 0) {
      this.context.recentRecommendations.push({
        type,
        location,
        items,
        timestamp: new Date(),
        query
      });

      // Maintain recommendations limit
      if (this.context.recentRecommendations.length > this.maxRecommendations) {
        this.context.recentRecommendations = this.context.recentRecommendations.slice(-this.maxRecommendations);
      }
    }
  }

  /**
   * Better extraction of recommendation items from content
   */
  private extractRecommendationItems(content: string): string[] {
    const lines = content.split('\n');
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for various recommendation formats
      const patterns = [
        /^\d+\.\s*\*\*(.+?)\*\*/, // 1. **Item**
        /^[-*•]\s*\*\*(.+?)\*\*/, // - **Item**
        /^\*\*\d+\.\s*(.+?)\*\*/, // **1. Item**
        /^\d+\.\s*(.+?)(?:\s*-|\s*$)/, // 1. Item - description
        /^[-*•]\s*(.+?)(?:\s*-|\s*$)/, // - Item - description
      ];

      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
          items.push(match[1].trim());
          break;
        }
      }
    }

    return items;
  }

  /**
   * Generate relevant follow-up questions based on context
   */
  private generatePendingQuestions(recommendationType?: string, location?: string): void {
    this.context.pendingQuestions = [];

    if (recommendationType === 'restaurants' && location) {
      this.context.pendingQuestions = [
        `Would you like recommendations for any specific cuisine in ${location}?`,
        `Are you looking for restaurants in a particular area of ${location}?`,
        `What's your budget range for dining in ${location}?`,
        `Do you need restaurants for any specific meal times?`
      ];
    } else if (recommendationType === 'activities' && location) {
      this.context.pendingQuestions = [
        `Are you interested in any specific types of activities in ${location}?`,
        `How many days are you planning to stay in ${location}?`,
        `Are you traveling with family, friends, or solo?`,
        `Do you prefer indoor or outdoor activities?`
      ];
    } else if (recommendationType === 'hotels' && location) {
      this.context.pendingQuestions = [
        `What's your preferred budget range for accommodation in ${location}?`,
        `Are you looking for hotels in a specific area of ${location}?`,
        `Do you need any specific amenities (pool, gym, breakfast)?`,
        `When are you planning to stay in ${location}?`
      ];
    }
  }

  /**
   * Check if the message is a follow-up question
   */
  isFollowUpQuestion(message: string): boolean {
    const followUpIndicators = [
      'what about', 'how about', 'any other', 'also', 'additionally',
      'what else', 'more', 'other options', 'alternatives', 'and',
      'or', 'instead', 'rather', 'different', 'another', 'similar',
      'thanks', 'thank you', 'great', 'perfect', 'good', 'nice'
    ];
    
    const messageL = message.toLowerCase();
    
    // Check for follow-up indicators
    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      messageL.includes(indicator)
    );

    // Check if question is short (likely follow-up)
    const isShortQuestion = message.split(' ').length <= 8 && messageL.includes('?');

    // Check if recent recommendations exist
    const hasRecentRecommendations = this.hasRecentRecommendations(5); // within 5 minutes

    return (hasFollowUpIndicator || isShortQuestion) && hasRecentRecommendations;
  }

  /**
   * Check if there are recent recommendations
   */
  hasRecentRecommendations(withinMinutes = 10): boolean {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
    return this.context.recentRecommendations.some(rec => rec.timestamp > cutoffTime);
  }

  /**
   * Get the last assistant turn
   */
  getLastAssistantTurn(): ConversationTurn | undefined {
    return this.context.conversationHistory
      .slice()
      .reverse()
      .find(turn => turn.role === 'assistant');
  }

  /**
   * Update user preferences mentioned in conversation
   */
  updateMentionedPreferences(preferences: Record<string, string>): void {
    const timestamp = new Date();
    Object.entries(preferences).forEach(([key, value]) => {
      if (value) {
        this.context.mentionedPreferences[key] = {
          value,
          timestamp
        };
      }
    });
    this.saveToCache();
  }

  /**
   * Set the current destination with context update and cache invalidation
   */
  setCurrentDestination(destination: string): void {
    if (this.context.currentDestination !== destination) {
      // Clear destination-specific cache when destination changes
      this.cacheManager.emitEvent(CacheEvent.DESTINATION_CHANGE, { 
        oldDestination: this.context.currentDestination,
        newDestination: destination 
      });
      
      this.context.currentDestination = destination;
      this.context.state.activeLocation = destination;
      this.context.state.phase = 'destination_planning';
      this.saveToCache();
    }
  }

  /**
   * Set the current topic
   */
  setCurrentTopic(topic: string): void {
    this.context.currentTopic = topic;
    this.saveToCache();
  }

  /**
   * Get contextual response suggestions based on conversation state
   */
  getContextualSuggestions(): string[] {
    const { state } = this.context;
    
    if (state.awaitingFollowUp && state.activeLocation) {
      if (state.activeRecommendationType === 'restaurants') {
        return [
          `What about activities in ${state.activeLocation}?`,
          `Where should I stay in ${state.activeLocation}?`,
          `Any specific cuisine recommendations?`,
          `What about different price ranges?`
        ];
      } else if (state.activeRecommendationType === 'activities') {
        return [
          `Where should I eat in ${state.activeLocation}?`,
          `What about nightlife in ${state.activeLocation}?`,
          `Any indoor alternatives?`,
          `What about nearby attractions?`
        ];
      }
    }

    // Default suggestions based on conversation flow
    if (state.conversationFlow.includes(ChatIntent.GET_RECOMMENDATIONS)) {
      return [
        'Plan a full itinerary',
        'Tell me about local customs',
        'What about transportation?',
        'Weather information'
      ];
    }

    return [
      'Get restaurant recommendations',
      'Find things to do',
      'Plan an itinerary',
      'Ask about travel tips'
    ];
  }

  /**
   * Determine the best response strategy based on context
   */
  getResponseStrategy(): 'direct_answer' | 'clarifying_question' | 'follow_up_suggestion' | 'context_aware' {
    const recentHistory = this.getRecentHistory(3);
    const lastUserTurn = recentHistory.filter(t => t.role === 'user').pop();

    if (!lastUserTurn) return 'direct_answer';

    // If user asked a follow-up question
    if (this.isFollowUpQuestion(lastUserTurn.content)) {
      return 'context_aware';
    }

    // If this is the first recommendation request
    if (lastUserTurn.intent === ChatIntent.GET_RECOMMENDATIONS && 
        !this.hasRecentRecommendations(30)) {
      return 'direct_answer';
    }

    // If user seems to need clarification
    if (lastUserTurn.content.length < 20 || (lastUserTurn.confidence && lastUserTurn.confidence < 0.7)) {
      return 'clarifying_question';
    }

    return 'direct_answer';
  }

  /**
   * Check if a specific topic was recently discussed
   */
  wasRecentlyDiscussed(topic: string, withinMinutes = 30): boolean {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
    
    return this.context.conversationHistory.some(turn => {
      return turn.timestamp > cutoffTime && 
        (turn.content.toLowerCase().includes(topic.toLowerCase()) ||
         turn.parameters?.question?.specificTopic?.toLowerCase() === topic.toLowerCase());
    });
  }

  /**
   * Get the dominant topic in recent conversation
   */
  getDominantTopic(recentTurns = 5): string | undefined {
    const recentHistory = this.getRecentHistory(recentTurns);
    
    // Simple frequency analysis
    const topicFrequency: Record<string, number> = {};
    
    recentHistory.forEach(turn => {
      if (turn.parameters?.destination) {
        topicFrequency[turn.parameters.destination] = (topicFrequency[turn.parameters.destination] || 0) + 1;
      }
      if (turn.parameters?.question?.specificTopic) {
        topicFrequency[turn.parameters.question.specificTopic] = (topicFrequency[turn.parameters.question.specificTopic] || 0) + 1;
      }
    });

    const topics = Object.entries(topicFrequency);
    if (topics.length === 0) return undefined;

    // Return the most frequently mentioned topic
    return topics.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  /**
   * Get the current conversation context
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Get recent conversation history
   */
  getRecentHistory(turns = 5): ConversationTurn[] {
    return this.context.conversationHistory.slice(-turns);
  }

  /**
   * Get recent recommendations of a specific type
   */
  getRecentRecommendations(type?: string, withinMinutes = 30): typeof this.context.recentRecommendations {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
    let recommendations = this.context.recentRecommendations.filter(rec => rec.timestamp > cutoffTime);
    
    if (type) {
      recommendations = recommendations.filter(rec => rec.type === type);
    }
    
    return recommendations;
  }

  /**
   * Get all mentioned preferences
   */
  getMentionedPreferences(): typeof this.context.mentionedPreferences {
    return { ...this.context.mentionedPreferences };
  }

  /**
   * Get pending questions for follow-up
   */
  getPendingQuestions(): string[] {
    return [...this.context.pendingQuestions];
  }

  /**
   * Clear conversation context and cache
   */
  clearContext(): void {
    this.context = this.initializeContext();
    this.saveToCache();
    
    // Clear all conversation-related cache entries
    this.cacheManager.clearNamespace(this.cacheNamespace);
  }

  /**
   * Get conversation analytics for debugging
   */
  getAnalytics(): {
    totalTurns: number;
    userTurns: number;
    assistantTurns: number;
    averageConfidence: number;
    topIntents: Array<{ intent: string; count: number }>;
    conversationAge: number;
    cacheStats: any;
  } {
    const userTurns = this.context.conversationHistory.filter(t => t.role === 'user');
    const assistantTurns = this.context.conversationHistory.filter(t => t.role === 'assistant');
    
    const confidenceValues = this.context.conversationHistory
      .map(t => t.confidence)
      .filter(c => c !== undefined) as number[];
    
    const averageConfidence = confidenceValues.length > 0 
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length 
      : 0;

    const intentCounts: Record<string, number> = {};
    this.context.conversationHistory.forEach(turn => {
      if (turn.intent) {
        intentCounts[turn.intent] = (intentCounts[turn.intent] || 0) + 1;
      }
    });

    const topIntents = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const conversationAge = Date.now() - this.context.createdAt.getTime();

    return {
      totalTurns: this.context.conversationHistory.length,
      userTurns: userTurns.length,
      assistantTurns: assistantTurns.length,
      averageConfidence,
      topIntents,
      conversationAge,
      cacheStats: this.cacheManager.getAnalytics()
    };
  }
} 