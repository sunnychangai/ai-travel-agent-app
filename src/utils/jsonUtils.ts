/**
 * Attempts to repair malformed JSON with common issues like unterminated strings
 * @param jsonString Potentially malformed JSON string
 * @returns Repaired JSON string that can be parsed
 */
export const repairJsonString = (jsonString: string): string => {
  // Early return for empty strings
  if (!jsonString || !jsonString.trim()) {
    return '';
  }
  
  // First, try to remove any markdown code blocks
  let repairedString = jsonString.trim();
  
  // Clean up markdown code blocks in one pass
  if (repairedString.startsWith('```')) {
    const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)```$/;
    const match = repairedString.match(codeBlockRegex);
    if (match && match[1]) {
      repairedString = match[1].trim();
    } else {
      // Just remove the starting ticks if we can't find the ending ones
      repairedString = repairedString.replace(/^```(?:json)?\s*/, '');
    }
  }
  
  // Use a more efficient approach to fix common JSON issues - combine multiple passes
  const fixCommonIssues = () => {
    // Fix property names and values in a more streamlined process
    repairedString = repairedString
      // Remove trailing commas - fixes common syntax errors
      .replace(/,(\s*[}\]])/g, '$1')
      // Simple whitespace normalization for better parsing
      .replace(/\\n/g, ' ')
      // Fix unquoted property names (handle edge cases better)
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3')
      // Convert single quotes to double quotes (more efficiently)
      .replace(/'([^'\\]*(\\.[^'\\]*)*)'(\s*:)/g, '"$1"$3') // for keys
      .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'([,}]|$)/g, ':"$1"$3'); // for values
  };
  
  // First pass to fix common issues
  fixCommonIssues();
  
  try {
    // Quick test to see if our simple fixes worked
    JSON.parse(repairedString);
    return repairedString;
  } catch (e) {
    // If simple fixes didn't work, try more aggressive repair
    
    // Try again with more aggressive fixes for nested structures
    fixCommonIssues();
    
    // Balance braces and brackets
    const balanceChars = (openChar: string, closeChar: string) => {
      const openCount = (repairedString.match(new RegExp(`\\${openChar}`, 'g')) || []).length;
      const closeCount = (repairedString.match(new RegExp(`\\${closeChar}`, 'g')) || []).length;
      
      if (openCount > closeCount) {
        repairedString += closeChar.repeat(openCount - closeCount);
      }
    };
    
    // Balance quotes - handles unterminated strings
    const quoteCount = (repairedString.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repairedString += '"';
    }
    
    // Balance braces and brackets
    balanceChars('{', '}');
    balanceChars('[', ']');
    
    return repairedString;
  }
};

/**
 * Extracts JSON from a text string, considering multiple possible formats
 * @param text Text potentially containing JSON
 * @returns Extracted JSON string or null if not found
 */
export const extractJsonFromText = (text: string): string | null => {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                   text.match(/```\s*([\s\S]*?)\s*```/) ||
                   text.match(/({[\s\S]*})/);
  
  return jsonMatch ? jsonMatch[1].trim() : null;
};

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @returns Parsed object or null if parsing failed
 */
export const safeJsonParse = <T>(jsonString: string): T | null => {
  if (!jsonString) return null;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    // Try to repair the JSON before giving up
    try {
      const repairedJson = repairJsonString(jsonString);
      return JSON.parse(repairedJson) as T;
    } catch (repairError) {
      console.error('Error parsing JSON after repair attempt:', repairError);
      return null;
    }
  }
}; 