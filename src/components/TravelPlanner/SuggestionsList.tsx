import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Edit, X } from "lucide-react";

interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  location: string;
  duration: string;
}

interface SuggestionsListProps {
  suggestions?: SuggestionItem[];
  onAccept?: (suggestion: SuggestionItem) => void;
  onModify?: (suggestion: SuggestionItem) => void;
  onReject?: (suggestion: SuggestionItem) => void;
}

const SuggestionsList = ({
  suggestions = [
    {
      id: "1",
      title: "Visit the Eiffel Tower",
      description:
        "Iconic iron lattice tower on the Champ de Mars in Paris, France.",
      imageUrl:
        "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=80",
      location: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
      duration: "2 hours",
    },
    {
      id: "2",
      title: "Louvre Museum Tour",
      description:
        "World's largest art museum and a historic monument in Paris, France.",
      imageUrl:
        "https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=400&q=80",
      location: "Rue de Rivoli, 75001 Paris, France",
      duration: "3 hours",
    },
    {
      id: "3",
      title: "Seine River Cruise",
      description:
        "Scenic boat tour along the Seine River with views of Paris landmarks.",
      imageUrl:
        "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80",
      location: "Port de la Conférence, 75008 Paris, France",
      duration: "1 hour",
    },
  ],
  onAccept = () => {},
  onModify = () => {},
  onReject = () => {},
}: SuggestionsListProps) => {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-medium">AI Suggestions</h3>
        <p className="text-sm text-gray-500">Based on your current itinerary</p>
      </div>

      <ScrollArea className="h-[400px] w-full">
        <div className="p-4 space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-1/3 h-40 sm:h-auto">
                  <img
                    src={suggestion.imageUrl}
                    alt={suggestion.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <CardHeader>
                    <CardTitle>{suggestion.title}</CardTitle>
                    <CardDescription>{suggestion.location}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      {suggestion.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Duration: {suggestion.duration}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReject(suggestion)}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onModify(suggestion)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modify
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onAccept(suggestion)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </CardFooter>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SuggestionsList;
