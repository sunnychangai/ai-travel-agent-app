/**
 * Optimized prompt templates for itinerary generation
 */

export const ATTRACTION_PROMPT = `Expert travel guide for {destination}: List {count} attractions matching interests: {interests}.
Include for each: name, description (30 words max), visit duration (hours), best time to visit, address, type (museum, landmark, etc).
Return JSON array: [{name, description, duration, bestTime, address, type}]`;

export const RESTAURANT_PROMPT = `Food expert for {destination}: List {count} restaurants matching {preferences}.
Include for each: name, cuisine, price ($-$$$), specialty dish, location, best meal time.
IMPORTANT: Follow local dining customs - dinner should not be before 7:00 PM minimum, with many European countries dining after 8:00-9:00 PM.
Return JSON array: [{name, cuisine, priceRange, specialtyDish, location, bestMealTime}]`;

export const DAILY_PLAN_PROMPT = `Create day {dayNumber} plan for {destination} with these activities: {activities}.
Arrange logically considering: opening hours, proximity, meal times ({preferences}), transit via {transportMode}.
CRITICAL: Follow local dining customs - dinner must be at least 7:00 PM or later. For European destinations, dinner is typically 8:00-9:00 PM or later.
Include duration, specific time, and brief tips for each.
Return JSON: {orderedActivities: [{id, startTime, endTime, notes}]}`;

export const PERSONALIZATION_PROMPT = `Personalize this {destination} itinerary for:
- Style: {travelStyle}
- Interests: {interests}
- Group: {travelGroup}
- Budget: {budget}
- Diet: {dietaryPreferences}
Adjust activities for pace preference, match interests, add personal tips.
Return JSON with modified itinerary.`;

export const DESCRIPTION_ENHANCEMENT_PROMPT = `Enhance: {activity} in {destination}
Current: {description}
Write 2-3 engaging sentences (under 80 words) highlighting what's special, an interesting fact, and a specific experience.
Avoid generic travel language.`;

export const ITINERARY_BALANCING_PROMPT = `Analyze this {destination} itinerary ({startDate} to {endDate}):
{draftItinerary}
Fix these issues:
1. Overcrowded/empty days
2. Poor activity distribution
3. Inefficient routing
4. Unrealistic timing
5. Missing categories (meals, rest)
Return balanced JSON with same structure.`;

export const ACTIVITY_CATEGORIZATION_PROMPT = `Categorize each activity:
{activities}
Categories:
- Sightseeing: landmark, viewpoint, monument, architectural
- Cultural: museum, gallery, performance, historical, religious
- Active: hiking, water sport, adventure, cycling, walking tour
- Food: restaurant, market, food tour, cooking class, cafe
- Nature: park, garden, beach, mountain, wildlife
- Entertainment: show, nightlife, shopping, festival, sports
- Transportation: airport, transfer, transit, rental
- Accommodation: check-in, check-out, hotel
- Relaxation: spa, wellness, beach time, rest
Return JSON: [{id, category, subcategory}]`; 