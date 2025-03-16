import React from "react";
import { Button } from "../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { Download, Share2, Printer, Save, RefreshCw } from "lucide-react";

interface ItineraryActionsProps {
  onSave?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  isExporting?: boolean;
  isPrinting?: boolean;
  isSharing?: boolean;
  isRefreshing?: boolean;
}

const ItineraryActions = ({
  onSave = () => {},
  onShare = () => {},
  onExport = () => {},
  onPrint = () => {},
  onRefresh = () => {},
  isSaving = false,
  isExporting = false,
  isPrinting = false,
  isSharing = false,
  isRefreshing = false,
}: ItineraryActionsProps) => {
  return (
    <div className="w-full h-[100px] bg-white border-t border-gray-200 p-4 flex items-center justify-between">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="mr-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="flex space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onSave}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save itinerary</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onShare}
                disabled={isSharing}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Share itinerary</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onExport}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export itinerary</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onPrint}
                disabled={isPrinting}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Print itinerary</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="default">Finalize Itinerary</Button>
      </div>
    </div>
  );
};

export default ItineraryActions;
