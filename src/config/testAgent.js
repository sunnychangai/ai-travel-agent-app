/**
 * Test function to verify agent rules integration
 * This file can be run separately to test the OpenAI API with the agent rules
 */

import { openai } from '../services/openaiService';
import { agentRules } from './agentRules';

// This function tests the agent rules integration with OpenAI
export const testAgentRules = async () => {
  try {
    console.log('Testing agent rules integration with OpenAI...');
    
    // Test prompt
    const testPrompt = "I want to plan a trip to Paris for next week";
    
    // Create a chat completion with the agent rules
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: testPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    console.log('Response received from OpenAI:');
    console.log(response.choices[0].message.content);
    
    return {
      success: true,
      message: 'Agent rules test completed successfully'
    };
  } catch (error) {
    console.error('Error testing agent rules:', error);
    return {
      success: false,
      message: `Error testing agent rules: ${error.message}`,
      error
    };
  }
};

// If this file is run directly
if (typeof window !== 'undefined' && window.location.pathname.includes('test-agent')) {
  console.log('Running agent rules test...');
  testAgentRules()
    .then(result => {
      console.log('Test result:', result);
    })
    .catch(error => {
      console.error('Test error:', error);
    });
} 