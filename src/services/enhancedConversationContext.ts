import { ChatIntent, IntentParameters } from './intentClassificationService';

export interface ConversationTurn {
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
}

export class EnhancedConversationContext {
  private context: ConversationContext;
  private readonly maxHistoryLength: number;
  private readonly maxRecommendations: number;

  constructor(maxHistoryLength = 15, maxRecommendations = 10) {
    this.maxHistoryLength = maxHistoryLength;
    this.maxRecommendations = maxRecommendations;
    this.context = this.initializeContext();
  }

  private initializeContext(): ConversationContext {
    return {
      state: {
        phase: 'greeting',
        awaitingFollowUp: false,
        conversationFlow: []
      },
      recentRecommendations: [],
      mentionedPreferences: {},
      conversationHistory: [],
      pendingQuestions: []
    };
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
  ) {
    const turnId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const turn: ConversationTurn = {
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
        turn.followUpTo = turnId; // Reference to the previous turn
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
      this.context.currentDestination = location;
      this.context.state.activeLocation = location;
    }

    // Track recommendations if present
    if (role === 'assistant' && intent === ChatIntent.GET_RECOMMENDATIONS) {
      this.addRecommendation(
        parameters?.recommendationType || 'general',
        parameters?.location || this.context.currentDestination || 'Unknown',
        content,
        content // Store original query - could be enhanced to get actual user query
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
  }

  /**
   * Update conversation state based on the current turn
   */
  private updateConversationState(turn: ConversationTurn) {
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
          this.context.state.awaitingFollowUp = true; // Expect possible follow-ups
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
   * Generate relevant follow-up questions based on context
   */
  private generatePendingQuestions(recommendationType?: string, location?: string) {
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
    if (lastUserTurn.content.length < 20 || lastUserTurn.confidence && lastUserTurn.confidence < 0.7) {
      return 'clarifying_question';
    }

    return 'direct_answer';
  }

  /**
   * Enhanced recommendation tracking
   */
  private addRecommendation(type: string, location: string, content: string, query: string) {
    // Extract recommended items from the content with better parsing
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
      // Look for numbered lists, bullet points, or bold items
      if (trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/)) {
        const match = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/);
        if (match) items.push(match[1]);
      } else if (trimmed.match(/^[-*•]\s*\*\*(.+?)\*\*/)) {
        const match = trimmed.match(/^[-*•]\s*\*\*(.+?)\*\*/);
        if (match) items.push(match[1]);
      } else if (trimmed.match(/^\*\*\d+\.\s*(.+?)\*\*/)) {
        const match = trimmed.match(/^\*\*\d+\.\s*(.+?)\*\*/);
        if (match) items.push(match[1]);
      }
    }

    return items;
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
   * Get pending questions for follow-up
   */
  getPendingQuestions(): string[] {
    return [...this.context.pendingQuestions];
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
   * Clear conversation context
   */
  clearContext() {
    this.context = this.initializeContext();
  }

  /**
   * Set current destination with context update
   */
  setCurrentDestination(destination: string) {
    this.context.currentDestination = destination;
    this.context.state.activeLocation = destination;
    this.context.state.phase = 'destination_planning';
  }
} 