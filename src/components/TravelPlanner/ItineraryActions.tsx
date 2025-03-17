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
  onShare?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isExporting?: boolean;
  isSharing?: boolean;
  isRefreshing?: boolean;
}

const ItineraryActions = ({
  onShare = () => {},
  onExport = () => {},
  onRefresh = () => {},
  isExporting = false,
  isSharing = false,
  isRefreshing = false,
}: ItineraryActionsProps) => {
  return (
    <div className="w-full h-[60px] bg-white border-t border-gray-200 p-4 flex items-center justify-center gap-4 z-10 relative">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-9 w-9 p-0"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              disabled={isSharing}
              className="h-9"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
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
              size="sm"
              onClick={onExport}
              disabled={isExporting}
              className="h-9"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export itinerary</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="default" className="h-9">Finalize Itinerary</Button>
    </div>
  );
};

export default ItineraryActions;
