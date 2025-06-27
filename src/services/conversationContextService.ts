import { ChatIntent, IntentParameters } from './intentClassificationService';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  parameters?: IntentParameters;
}

export interface ConversationContext {
  currentDestination?: string;
  currentTopic?: string;
  recentRecommendations: {
    type: string;
    items: string[];
    timestamp: Date;
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
}

export class ConversationContextService {
  private context: ConversationContext;
  private readonly maxHistoryLength: number;
  private readonly maxRecommendations: number;

  constructor(maxHistoryLength = 10, maxRecommendations = 5) {
    this.maxHistoryLength = maxHistoryLength;
    this.maxRecommendations = maxRecommendations;
    this.context = this.initializeContext();
  }

  private initializeContext(): ConversationContext {
    return {
      recentRecommendations: [],
      mentionedPreferences: {},
      conversationHistory: [],
    };
  }

  /**
   * Add a new turn to the conversation history
   */
  addConversationTurn(
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters
  ) {
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: new Date(),
      intent,
      parameters,
    };

    this.context.conversationHistory.push(turn);
    
    // Maintain history length limit
    if (this.context.conversationHistory.length > this.maxHistoryLength) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-this.maxHistoryLength);
    }

    // Update last intent and parameters
    if (role === 'user' && intent) {
      this.context.lastIntent = intent;
      this.context.lastParameters = parameters;
    }

    // Update current destination if present in parameters
    if (parameters?.destination) {
      this.context.currentDestination = parameters.destination;
    }

    // Track recommendations if present
    if (role === 'assistant' && intent === ChatIntent.GET_RECOMMENDATIONS) {
      this.addRecommendation(parameters?.recommendationType || 'general', content);
    }
  }

  /**
   * Add a new recommendation to tracking
   */
  private addRecommendation(type: string, content: string) {
    // Extract recommended items from the content (simplified - you might want to make this more robust)
    const items = content
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.trim().replace(/^[-*]\s*/, ''));

    if (items.length > 0) {
      this.context.recentRecommendations.push({
        type,
        items,
        timestamp: new Date()
      });

      // Maintain recommendations limit
      if (this.context.recentRecommendations.length > this.maxRecommendations) {
        this.context.recentRecommendations = this.context.recentRecommendations.slice(-this.maxRecommendations);
      }
    }
  }

  /**
   * Update user preferences mentioned in conversation
   */
  updateMentionedPreferences(preferences: Record<string, string>) {
    const timestamp = new Date();
    Object.entries(preferences).forEach(([key, value]) => {
      if (value) {
        this.context.mentionedPreferences[key] = {
          value,
          timestamp
        };
      }
    });
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
  getRecentRecommendations(type?: string): typeof this.context.recentRecommendations {
    if (type) {
      return this.context.recentRecommendations.filter(rec => rec.type === type);
    }
    return this.context.recentRecommendations;
  }

  /**
   * Get all mentioned preferences
   */
  getMentionedPreferences(): typeof this.context.mentionedPreferences {
    return { ...this.context.mentionedPreferences };
  }

  /**
   * Clear the conversation context
   */
  clearContext() {
    this.context = this.initializeContext();
  }

  /**
   * Set the current destination
   */
  setCurrentDestination(destination: string) {
    this.context.currentDestination = destination;
  }

  /**
   * Set the current topic
   */
  setCurrentTopic(topic: string) {
    this.context.currentTopic = topic;
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
    
    // Simple frequency analysis - could be made more sophisticated
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
} 