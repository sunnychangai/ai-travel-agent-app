import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../ui/use-toast';
import { MessageSquare, Send, CheckCircle, Package } from 'lucide-react';
import { feedbackService } from '../../services/feedbackService';
import { useAuth } from '../../contexts/AuthContext';
import VersionHistoryPage from '../version-history/VersionHistoryPage';

interface FeedbackFormData {
  feedbackType: string;
  message: string;
  name: string;
  email: string;
}

interface FeedbackPageProps {
  onClose?: () => void;
}

export default function FeedbackPage({ onClose }: FeedbackPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    feedbackType: '',
    message: '',
    name: '',
    email: ''
  });

  const handleInputChange = (field: keyof FeedbackFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitMore = () => {
    // Reset form and go back to feedback form
    setIsSubmitted(false);
    setFormData({
      feedbackType: '',
      message: '',
      name: '',
      email: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.feedbackType || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in the feedback type and message fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await feedbackService.submitFeedback(
        {
          feedbackType: formData.feedbackType,
          message: formData.message,
          name: formData.name,
          email: formData.email
        },
        user?.id
      );

      if (result.success) {
        setIsSubmitted(true);
        toast({
          title: "Feedback Submitted!",
          description: result.message,
          variant: "default",
        });
        
        // Don't auto close - let user choose to submit more or close
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "There was an error submitting your feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
        <p className="text-gray-600 mb-6">
          Your feedback has been submitted successfully. We appreciate you helping us improve AI Travel Agent.
        </p>
        <div className="flex gap-3">
          <Button onClick={handleSubmitMore} className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Submit More Feedback
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full p-4 h-full overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Beta Feedback</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVersionHistory(true)}
              className="flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              Version History
            </Button>
          </div>
          <p className="text-gray-600">
            Help us improve AI Travel Agent by sharing your experience and suggestions.
          </p>
        </div>

      <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Feedback Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What type of feedback do you have?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Select value={formData.feedbackType} onValueChange={(value) => handleInputChange('feedbackType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select feedback type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="improvement">Improvement Suggestion</SelectItem>
                  <SelectItem value="general">General Feedback</SelectItem>
                  <SelectItem value="praise">Positive Feedback</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Detailed Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Feedback</CardTitle>
              <CardDescription className="text-sm">
                Please provide detailed information about your experience, suggestions, or any issues you encountered.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Textarea
                placeholder="Describe your feedback in detail..."
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Name (Optional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Name (Optional)</CardTitle>
              <CardDescription className="text-sm">
                Your name helps us personalize our response
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Input
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Email (Optional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Email (Optional)</CardTitle>
              <CardDescription className="text-sm">
                Leave your email if you'd like us to follow up on your feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.feedbackType || !formData.message}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Version History Modal */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Version History
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
            <VersionHistoryPage />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 