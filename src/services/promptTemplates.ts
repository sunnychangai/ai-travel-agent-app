/**
 * Specialized prompt templates for itinerary generation
 * These templates are designed to get high-quality, specific responses from OpenAI
 */

export const ATTRACTION_PROMPT = `
As a travel expert for {destination}, recommend {count} must-visit attractions that match these interests: {interests}.
For each attraction, provide:
1. Name
2. Brief description (2-3 sentences max)
3. Typical visit duration in hours
4. Best time of day to visit
5. Location address
6. Type (museum, landmark, nature, etc.)

Format as JSON with array of objects containing: name, description, duration, bestTime, address, type.
`;

export const RESTAURANT_PROMPT = `
As a food expert for {destination}, recommend {count} restaurants with:
1. Name
2. Cuisine type
3. Price range ($ to $$$)
4. One specialty dish
5. Neighborhood or address
6. Best meal period (breakfast, lunch, dinner)

Focus on places that are: {preferences}
Format as JSON with array of objects containing: name, cuisine, priceRange, specialtyDish, location, bestMealTime.
`;

export const DAILY_PLAN_PROMPT = `
Create a logical day plan for day {dayNumber} in {destination} with these activities: {activities}.

Arrange them in a logical sequence considering:
1. Opening hours
2. Geographic proximity
3. Typical meal times ({preferences})
4. Transit time between places ({transportMode})
5. Reasonable pace with short breaks

For each activity, also suggest:
1. Estimated duration
2. Time of day (specific hour)
3. Any tips or notes

Format as JSON with array of orderedActivities with: id, startTime, endTime, notes.
`;

export const PERSONALIZATION_PROMPT = `
Personalize this draft itinerary for {destination} to better match:
- Travel style: {travelStyle} (e.g. relaxed, active, cultural)
- Interests: {interests}
- Traveling with: {travelGroup} (e.g. family with kids, couple, solo)
- Budget level: {budget} (e.g. budget, mid-range, luxury)

Make these specific adjustments:
1. Add or remove activities to match the pace preference
2. Suggest alternatives that better match the interests
3. Add personalized recommendations or tips for each day
4. Adjust the meal suggestions to match dietary preferences: {dietaryPreferences}

Format as JSON with the modified itinerary.
`;

export const DESCRIPTION_ENHANCEMENT_PROMPT = `
Enhance this basic activity description to make it more engaging:
Activity: {activity}
Current description: {description}
Destination: {destination}

Write a concise but vivid 2-3 sentence description that:
1. Highlights what makes this place special
2. Includes a historical or interesting fact
3. Mentions a specific thing to notice or experience there

Keep it under 80 words and avoid generic travel language.
`;

export const ITINERARY_BALANCING_PROMPT = `
Analyze this draft itinerary for {destination} from {startDate} to {endDate}:
{draftItinerary}

Identify and fix these potential issues:
1. Days that are too crowded or too empty
2. Poor activity distribution (e.g., too many museums in one day)
3. Inefficient geographic routing
4. Unrealistic timing or duration estimates
5. Missing important categories (meals, rest periods, etc.)

Return a balanced version with these improvements.
Format as JSON with the same structure as the input.
`;

export const ACTIVITY_CATEGORIZATION_PROMPT = `
For each activity in this list, determine the most specific category and subcategory:

{activities}

Use these categories and subcategories:
- Sightseeing: [landmark, viewpoint, monument, architectural]
- Cultural: [museum, gallery, performance, historical site, religious site]
- Active: [hiking, water sport, adventure, cycling, walking tour]
- Food: [restaurant, market, food tour, cooking class, cafe]
- Nature: [park, garden, beach, mountain, wildlife]
- Entertainment: [show, nightlife, shopping, festival, sporting event]
- Transportation: [airport, transfer, transit, rental]
- Accommodation: [check-in, check-out, hotel activity]
- Relaxation: [spa, wellness, beach time, rest period]

Format as JSON with array of objects containing: id, category, subcategory.
`; 