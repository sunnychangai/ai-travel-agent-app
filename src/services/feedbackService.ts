import emailjs from '@emailjs/browser';
import { supabase } from './supabase';

interface FeedbackData {
  feedbackType: string;
  message: string;
  name?: string;
  email?: string;
}

interface FeedbackSubmissionResult {
  success: boolean;
  message: string;
  data?: any;
}

// EmailJS configuration - these should be set in your environment variables
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

// Initialize EmailJS with public key
if (EMAILJS_PUBLIC_KEY) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

export const feedbackService = {
  /**
   * Submit feedback - saves to Supabase and sends email notification
   */
  async submitFeedback(feedbackData: FeedbackData, userId?: string): Promise<FeedbackSubmissionResult> {
    try {
      // 1. Save to Supabase first - try with user_id, fallback to null if permission issues
      let dbData;
      let dbError;
      
      // First try with user_id
      const insertData = {
        user_id: userId || null,
        feedback_type: feedbackData.feedbackType,
        content: feedbackData.message,
        rating: null // We don't collect rating in our form, so set to null
      };

      const result = await supabase
        .from('feedback')
        .insert(insertData)
        .select()
        .single();
        
      dbData = result.data;
      dbError = result.error;

      // If we get a permission error and we had a userId, try without it
      if (dbError && dbError.message?.includes('permission') && userId) {
        console.warn('Permission error with user_id, trying anonymous submission...');
        const anonymousResult = await supabase
          .from('feedback')
          .insert({
            user_id: null,
            feedback_type: feedbackData.feedbackType,
            content: feedbackData.message,
            rating: null // We don't collect rating in our form, so set to null
          })
          .select()
          .single();
          
        dbData = anonymousResult.data;
        dbError = anonymousResult.error;
      }

      if (dbError) {
        console.error('Error saving feedback to database:', dbError);
        throw new Error(`Failed to save feedback to database: ${dbError.message}`);
      }

             // 2. Send email notification via EmailJS
       let emailSent = false;
       let emailError: string | null = null;

       if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
         try {
           const emailParams = {
             to_email: 'sunnyschangai@gmail.com',
             from_name: feedbackData.name || 'Anonymous User',
             from_email: feedbackData.email || 'No email provided',
             feedback_type: feedbackData.feedbackType,
             message: feedbackData.message,
             submission_date: new Date().toLocaleString(),
             user_id: userId || 'Anonymous'
           };

           await emailjs.send(
             EMAILJS_SERVICE_ID,
             EMAILJS_TEMPLATE_ID,
             emailParams
           );
           emailSent = true;
         } catch (error) {
           console.error('Error sending email notification:', error);
           emailError = error instanceof Error ? error.message : 'Unknown email error';
           // Don't throw here - we still want to return success if database save worked
         }
       } else {
         console.warn('EmailJS not configured. Email notification will not be sent.');
       }

       return {
         success: true,
         message: emailSent 
           ? 'Feedback submitted successfully and email notification sent!'
           : 'Feedback submitted successfully! (Email notification not configured)',
         data: {
           feedback: dbData,
           emailSent,
           emailError
         }
       };

    } catch (error) {
      console.error('Error submitting feedback:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit feedback',
        data: { error }
      };
    }
  },

  /**
   * Check if EmailJS is properly configured
   */
  isEmailConfigured(): boolean {
    return !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
  },

  /**
   * Get configuration status for debugging
   */
  getConfigStatus() {
    return {
      emailjs: {
        serviceId: !!EMAILJS_SERVICE_ID,
        templateId: !!EMAILJS_TEMPLATE_ID,
        publicKey: !!EMAILJS_PUBLIC_KEY,
        configured: this.isEmailConfigured()
      },
      supabase: {
        url: !!import.meta.env.VITE_SUPABASE_URL,
        key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        configured: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
      }
    };
  }
}; 