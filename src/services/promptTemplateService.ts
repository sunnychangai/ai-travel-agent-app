import { ChatIntent, IntentParameters } from './intentClassificationService';

interface PromptContext {
  userPreferences?: {
    travelStyle?: string;
    interests?: string[];
    dietaryPreferences?: string[];
    budget?: string;
    accommodation?: string;
    transportation?: string;
    accessibility?: string[];
    pace?: string;
  };
  currentItinerary?: {
    destination: string;
    days: number;
    activities: any[]; // Replace with proper type from your itinerary context
  };
  currentDestination?: string;
}

/**
 * Service for generating contextual prompts based on user intent and conversation context
 */
export const promptTemplateService = {
  /**
   * Get the appropriate system prompt based on intent and context
   */
  getSystemPrompt(intent: ChatIntent, context: PromptContext): string {
    const basePrompt = `You are a helpful travel assistant specialized in creating personalized travel experiences. You have access to up-to-date information about destinations, activities, restaurants, and travel logistics.`;
    
    const contextInfo = this.getContextInfo(context);

    switch (intent) {
      case ChatIntent.NEW_ITINERARY:
        return `${basePrompt}
Your task is to create a comprehensive travel itinerary based on the user's request.

${contextInfo}

Guidelines:
- Create a detailed day-by-day itinerary with specific times and activities
- Include restaurant recommendations for meals
- Provide transportation details between locations
- Include estimated costs and booking information
- Add local tips and cultural insights
- Format the response for easy parsing into a structured itinerary
- Ensure activities align with user preferences and interests`;

      case ChatIntent.MODIFY_EXISTING:
        return `${basePrompt}
Your task is to modify an existing travel itinerary based on the user's specific request.

${contextInfo}

Guidelines:
- Make precise changes to the requested elements
- Maintain the overall flow and structure of the itinerary
- Adjust related elements (timing, transportation) as needed
- Ensure modifications align with user preferences
- Provide clear explanations for any significant changes`;

      case ChatIntent.GET_RECOMMENDATIONS:
        return `${basePrompt}
Your task is to provide specific recommendations based on the user's request.

${contextInfo}

Guidelines:
- Provide 2-3 high-quality recommendations
- Include practical details (location, hours, pricing, booking)
- Explain why each recommendation fits the user's preferences
- Include insider tips and local insights
- Format recommendations clearly with bullet points`;

      case ChatIntent.ASK_QUESTIONS:
        return `${basePrompt}
Your task is to answer travel-related questions with accurate, helpful information.

${contextInfo}

Guidelines:
- Provide accurate, up-to-date information
- Include practical details and actionable advice
- Consider the user's context and preferences in your answer
- Offer additional related suggestions when appropriate
- Citing reliable sources when possible`;

      case ChatIntent.GENERAL_CHAT:
      default:
        return `${basePrompt}
Your task is to engage in helpful travel-related conversation.

${contextInfo}

Focus on:
- Being friendly and conversational while remaining professional
- Guiding the conversation towards travel planning when appropriate
- Learning about user preferences through natural dialogue
- Offering helpful suggestions based on the conversation context`;
    }
  },

  /**
   * Get the appropriate user message template based on intent and parameters
   */
  getUserPrompt(intent: ChatIntent, parameters: IntentParameters, context: PromptContext): string {
    switch (intent) {
      case ChatIntent.NEW_ITINERARY:
        return this.getNewItineraryPrompt(parameters, context);
      case ChatIntent.MODIFY_EXISTING:
        return this.getModifyItineraryPrompt(parameters, context);
      case ChatIntent.GET_RECOMMENDATIONS:
        return this.getRecommendationsPrompt(parameters, context);
      case ChatIntent.ASK_QUESTIONS:
        return this.getQuestionsPrompt(parameters, context);
      case ChatIntent.GENERAL_CHAT:
      default:
        return this.getGeneralChatPrompt(parameters, context);
    }
  },

  /**
   * Get formatted context information
   */
  getContextInfo(context: PromptContext): string {
    const sections: string[] = ['Context:'];

    if (context.userPreferences) {
      sections.push('User Preferences:');
      const prefs = context.userPreferences;
      if (prefs.travelStyle) sections.push(`- Travel Style: ${prefs.travelStyle}`);
      if (prefs.interests?.length) sections.push(`- Interests: ${prefs.interests.join(', ')}`);
      if (prefs.dietaryPreferences?.length) sections.push(`- Dietary: ${prefs.dietaryPreferences.join(', ')}`);
      if (prefs.budget) sections.push(`- Budget: ${prefs.budget}`);
      if (prefs.accommodation) sections.push(`- Accommodation: ${prefs.accommodation}`);
      if (prefs.transportation) sections.push(`- Transportation: ${prefs.transportation}`);
      if (prefs.accessibility?.length) sections.push(`- Accessibility: ${prefs.accessibility.join(', ')}`);
      if (prefs.pace) sections.push(`- Pace: ${prefs.pace}`);
    }

    if (context.currentItinerary) {
      sections.push('\nCurrent Itinerary:');
      sections.push(`- Destination: ${context.currentItinerary.destination}`);
      sections.push(`- Duration: ${context.currentItinerary.days} days`);
      sections.push(`- Number of activities: ${context.currentItinerary.activities.length}`);
    }

    if (context.currentDestination && !context.currentItinerary) {
      sections.push(`\nCurrently discussing: ${context.currentDestination}`);
    }

    return sections.join('\n');
  },

  getNewItineraryPrompt(parameters: IntentParameters, context: PromptContext): string {
    return `Create a detailed travel itinerary for ${parameters.destination} 
${parameters.dates?.start ? `from ${parameters.dates.start}` : ''}
${parameters.dates?.end ? `to ${parameters.dates.end}` : ''}.

Please include:
1. Daily activities with specific times and durations
2. Restaurant recommendations for meals
3. Transportation details between locations
4. Estimated costs for activities and meals
5. Booking information where relevant
6. Local tips and cultural insights

The itinerary should be formatted for the visual itinerary builder interface.`;
  },

  getModifyItineraryPrompt(parameters: IntentParameters, context: PromptContext): string {
    const { modificationDetails } = parameters;
    return `Modify the current itinerary with the following changes:
${modificationDetails?.day ? `- Day: ${modificationDetails.day}` : ''}
${modificationDetails?.activity ? `- Activity: ${modificationDetails.activity}` : ''}
${modificationDetails?.type ? `- Type of change: ${modificationDetails.type}` : ''}

Please:
1. Make the requested changes
2. Adjust any affected timings
3. Update transportation details if needed
4. Maintain the flow of the itinerary
5. Ensure the changes align with user preferences

The changes should be reflected in the visual itinerary builder interface.`;
  },

  getRecommendationsPrompt(parameters: IntentParameters, context: PromptContext): string {
    const location = parameters.location || context.currentDestination;
    const type = parameters.recommendationType || 'general';
    
    if (type === 'activities') {
      return `Provide detailed activity recommendations for ${location}.

Please structure your response in these categories:
1. Top Tourist Attractions
   - Include 2-3 must-see landmarks or attractions
   - Mention opening hours, ticket prices, and booking tips
   - Suggest best times to visit and how long to spend

2. Cultural & Historical Sites
   - Include museums, galleries, historical buildings
   - Mention any special exhibitions or guided tours
   - Include insider tips for the best experience

3. Local Experiences
   - Include unique neighborhood activities
   - Suggest local markets or shopping areas
   - Recommend parks or outdoor spaces
   - Include off-the-beaten-path suggestions

4. Entertainment & Activities
   - Suggest current shows, performances, or events
   - Include family-friendly activities if relevant
   - Mention unique experiences specific to ${location}

For each recommendation, include:
- Name and brief description
- Location and how to get there
- Approximate cost
- Time needed
- Any special tips or insider advice
- Best time to visit
- Whether advance booking is recommended

Format each recommendation clearly with bullet points and organize them by category.`;
    }

    if (type === 'restaurants') {
      return `Provide restaurant recommendations in ${location}.

Please include:
1. 2-3 highly-rated restaurants in different price ranges
2. Popular local dishes and specialties
3. Best areas for dining
4. Mix of traditional and modern options
5. Both tourist favorites and local gems

For each recommendation, include:
- Cuisine type and price range
- Location and how to get there
- Signature dishes
- Atmosphere and dress code
- Booking information
- Best times to visit
- Local tips`;
    }

    return `Provide ${type} recommendations 
${location ? `in ${location}` : ''}.

Please include:
1. 2-3 specific recommendations with different characteristics
2. Location and how to get there
3. Price range and booking information
4. Why it matches user preferences
5. Best times to visit
6. Insider tips or special considerations

Format your response with clear headings and bullet points for easy reading.`;
  },

  getQuestionsPrompt(parameters: IntentParameters, context: PromptContext): string {
    const { question } = parameters;
    return `Answer the following ${question?.type || 'travel-related'} question 
${question?.specificTopic ? `about ${question.specificTopic}` : ''}.

Please provide:
1. Accurate and up-to-date information
2. Specific details and examples
3. Practical tips and advice
4. Cultural context if relevant
5. Any necessary warnings or considerations`;
  },

  getGeneralChatPrompt(parameters: IntentParameters, context: PromptContext): string {
    return `Engage in a helpful travel-related conversation.

Consider:
1. User's current context and preferences
2. Previous conversation topics
3. Opportunities to learn more about user preferences
4. Potential travel planning suggestions`;
  }
}; 