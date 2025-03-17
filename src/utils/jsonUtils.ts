/**
 * Attempts to repair malformed JSON with common issues like unterminated strings
 * @param jsonString Potentially malformed JSON string
 * @returns Repaired JSON string that can be parsed
 */
export const repairJsonString = (jsonString: string): string => {
  // Remove markdown code blocks
  let repairedString = jsonString
    .replace(/^```json\s*/g, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '');
    
  // Fix common JSON issues
  repairedString = repairedString
    .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
    .replace(/,\s*\]/g, ']')       // Remove trailing commas in arrays
    .replace(/\\n/g, ' ')          // Replace escaped newlines with spaces
    .replace(/\n/g, ' ')           // Replace literal newlines with spaces
    .replace(/\\"/g, '__QUOTE__')  // Temporarily replace escaped quotes
    
    // Fix property names without quotes or with single quotes
    .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')  // Add quotes to unquoted property names
    .replace(/([{,])\s*'([^']+)'\s*:/g, '$1"$2":')        // Replace single quotes with double quotes in property names
    
    // Fix issues with values
    .replace(/:\s*'([^']+)'/g, ':"$1"')     // Replace single-quoted values with double-quoted values
    
    .replace(/(?<!")"(?!")/g, '"') // Fix unbalanced quotes
    .replace(/__QUOTE__/g, '\\"'); // Restore escaped quotes
    
  // Check for unterminated strings
  const doubleQuotes = repairedString.match(/"/g);
  if (doubleQuotes && doubleQuotes.length % 2 !== 0) {
    // Add a closing quote at the end if needed
    repairedString += '"';
  }
  
  // Check for missing closing brackets
  const openBraces = (repairedString.match(/{/g) || []).length;
  const closeBraces = (repairedString.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repairedString += '}';
  }
  
  const openBrackets = (repairedString.match(/\[/g) || []).length;
  const closeBrackets = (repairedString.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repairedString += ']';
  }
  
  return repairedString.trim();
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
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}; 