/**
 * Type definition for agentRules module
 */

/**
 * Rules for the travel agent
 */
export interface AgentRules {
  /**
   * The system prompt for the agent
   */
  systemPrompt: string;
  
  /**
   * Rules for generating travel content
   */
  travelRules: {
    maxActivitiesPerDay: number;
    minActivitiesPerDay: number;
    defaultDuration: string;
    activityTypeDistribution: {
      cultural: number;
      outdoor: number;
      food: number;
      shopping: number;
      entertainment: number;
      relaxation: number;
    };
    mealTimes: {
      breakfast: string;
      lunch: string;
      dinner: string;
    };
  };
  
  /**
   * Example conversation to guide the AI
   */
  exampleConversation: Array<{
    role: string;
    content: string;
  }>;
  
  /**
   * Other configuration options
   */
  [key: string]: any;
}

/**
 * Agent rules for the travel agent
 */
export const agentRules: AgentRules; 