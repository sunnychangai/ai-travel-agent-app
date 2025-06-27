import { openaiService } from './openaiService';
import { withRetry } from '../utils/apiUtils';

// Intent types
export enum ChatIntent {
  NEW_ITINERARY = 'NEW_ITINERARY',
  MODIFY_EXISTING = 'MODIFY_EXISTING',
  GET_RECOMMENDATIONS = 'GET_RECOMMENDATIONS',
  ASK_QUESTIONS = 'ASK_QUESTIONS',
  GENERAL_CHAT = 'GENERAL_CHAT'
}

// Parameters that can be extracted for each intent
export interface IntentParameters {
  destination?: string;
  dates?: {
    start?: string;
    end?: string;
  };
  modificationDetails?: {
    day?: number;
    activity?: string;
    type?: 'add' | 'remove' | 'replace' | 'modify';
  };
  recommendationType?: 'restaurants' | 'activities' | 'hotels' | 'general';
  location?: string;
  question?: {
    type: 'logistics' | 'culture' | 'weather' | 'transportation' | 'other';
    specificTopic?: string;
  };
}

// Classification result
export interface IntentClassification {
  intent: ChatIntent;
  confidence: number;
  parameters: IntentParameters;
}

export const intentClassificationService = {
  /**
   * Classify the user's message intent using OpenAI
   */
  async classifyIntent(message: string, context: { 
    hasExistingItinerary: boolean;
    currentDestination?: string;
  }): Promise<IntentClassification> {
    const classificationPrompt = `
Analyze the following user message in the context of a travel planning conversation:

"${message}"

Context:
- User ${context.hasExistingItinerary ? 'has' : 'does not have'} an existing itinerary
${context.currentDestination ? `- Current destination being discussed: ${context.currentDestination}` : ''}

Classification Rules:
1. NEW_ITINERARY - When user explicitly asks to create/plan a new trip/itinerary
2. MODIFY_EXISTING - When user wants to change something in their current itinerary
3. GET_RECOMMENDATIONS - When user asks about:
   - Things to do/activities/attractions
   - Places to visit
   - Restaurants/food/dining
   - Hotels/accommodation
   - Shopping/entertainment
   - Day trips/tours
   - Any "what/where/which" questions about specific types of places or activities
4. ASK_QUESTIONS - When user asks about:
   - Travel logistics (how to get somewhere, transport options)
   - Cultural information
   - Weather
   - General travel advice
   - Any "how/why/when" questions
5. GENERAL_CHAT - Greetings, thank you, or very general conversation

Important:
- Questions about "what to do" or "things to do" should ALWAYS be classified as GET_RECOMMENDATIONS
- If the message mentions both a specific location and activities/things to do, classify as GET_RECOMMENDATIONS
- When in doubt between ASK_QUESTIONS and GET_RECOMMENDATIONS, prefer GET_RECOMMENDATIONS if the user is asking about places or activities

Return a JSON object in this format:
{
  "intent": "one of the intent categories",
  "confidence": "number between 0 and 1",
  "parameters": {
    "destination": "destination name if mentioned",
    "dates": {
      "start": "start date if mentioned",
      "end": "end date if mentioned"
    },
    "modificationDetails": {
      "day": "day number if mentioned",
      "activity": "activity to modify if mentioned",
      "type": "add/remove/replace/modify if clear"
    },
    "recommendationType": "restaurants/activities/hotels/general if asking for recommendations",
    "location": "specific location for recommendations if different from main destination",
    "question": {
      "type": "logistics/culture/weather/transportation/other for questions",
      "specificTopic": "specific topic being asked about"
    }
  }
}`;

    try {
      const response = await withRetry(() => openaiService.generateChatCompletion([
        { role: 'user', content: classificationPrompt }
      ], {
        model: 'gpt-3.5-turbo-1106',
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }));

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Post-process the classification
      if (message.toLowerCase().includes('what') && 
          (message.toLowerCase().includes('to do') || message.toLowerCase().includes('activities'))) {
        result.intent = ChatIntent.GET_RECOMMENDATIONS;
        result.parameters = {
          ...result.parameters,
          recommendationType: 'activities',
          location: result.parameters?.location || context.currentDestination
        };
      }
      
      return result as IntentClassification;
    } catch (error) {
      console.error('Error classifying intent:', error);
      // Return a default classification if something goes wrong
      return {
        intent: ChatIntent.GENERAL_CHAT,
        confidence: 0.5,
        parameters: {}
      };
    }
  }
}; 