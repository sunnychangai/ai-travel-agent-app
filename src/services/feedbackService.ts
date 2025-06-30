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
    console.log('🚀 FeedbackService: Starting feedback submission', {
      hasUserId: !!userId,
      feedbackType: feedbackData.feedbackType,
      messageLength: feedbackData.message.length,
      hasName: !!feedbackData.name,
      hasEmail: !!feedbackData.email
    });

    try {
      // 1. Validate input data
      if (!feedbackData.feedbackType || feedbackData.feedbackType.trim().length === 0) {
        throw new Error('Feedback type is required');
      }
      if (!feedbackData.message || feedbackData.message.trim().length === 0) {
        throw new Error('Feedback message is required');
      }
      if (feedbackData.message.length > 2000) {
        throw new Error('Feedback message too long (max 2000 characters)');
      }

      // 2. Save to Supabase with enhanced error handling
      let dbData;
      let dbError;
      
      // Prepare data for database
      const insertData = {
        user_id: userId || null,
        feedback_type: feedbackData.feedbackType.trim(),
        content: feedbackData.message.trim(), 
        rating: null, // We don't collect rating in our form
        created_at: new Date().toISOString()
      };

      console.log('📝 FeedbackService: Attempting database insert', {
        user_id: insertData.user_id ? 'present' : 'null',
        feedback_type: insertData.feedback_type,
        content_length: insertData.content.length
      });

      const result = await supabase
        .from('feedback')
        .insert(insertData)
        .select()
        .single();
        
      dbData = result.data;
      dbError = result.error;

      // Enhanced error handling with specific error types
      if (dbError) {
        console.error('❌ Database error details:', {
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code
        });

        // Check for specific error types and retry logic
        if (dbError.message?.includes('permission') || 
            dbError.message?.includes('policy') || 
            dbError.message?.includes('denied') ||
            dbError.code === 'PGRST301') {
          
          if (userId) {
            console.warn('🔄 Permission error with user_id, trying anonymous submission...');
            const anonymousResult = await supabase
              .from('feedback')
              .insert({
                user_id: null,
                feedback_type: insertData.feedback_type,
                content: insertData.content,
                rating: null,
                created_at: insertData.created_at
              })
              .select()
              .single();
              
            dbData = anonymousResult.data;
            dbError = anonymousResult.error;

            if (dbError) {
              console.error('❌ Anonymous submission also failed:', dbError);
              throw new Error(`Database permission error: ${dbError.message}. Please contact support.`);
            } else {
              console.log('✅ Anonymous submission successful');
            }
          } else {
            throw new Error(`Database permission error: ${dbError.message}. Please contact support.`);
          }
        } else {
          throw new Error(`Database error: ${dbError.message}`);
        }
      }

      if (!dbData) {
        throw new Error('No data returned from database after successful insert');
      }

      console.log('✅ Feedback saved to database successfully', { id: dbData.id });

      // 3. Send email notification via EmailJS (optional)
      let emailSent = false;
      let emailError: string | null = null;

      console.log('📧 FeedbackService: Checking email configuration', {
        hasServiceId: !!EMAILJS_SERVICE_ID,
        hasTemplateId: !!EMAILJS_TEMPLATE_ID,
        hasPublicKey: !!EMAILJS_PUBLIC_KEY
      });

      if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        try {
          const emailParams = {
            to_email: 'sunnyschangai@gmail.com',
            from_name: feedbackData.name || 'Anonymous User',
            from_email: feedbackData.email || 'No email provided',
            feedback_type: feedbackData.feedbackType,
            message: feedbackData.message,
            submission_date: new Date().toLocaleString(),
            user_id: userId || 'Anonymous',
            feedback_id: dbData.id || 'unknown'
          };

          console.log('📧 FeedbackService: Sending email notification...');
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            emailParams
          );
          emailSent = true;
          console.log('✅ Email notification sent successfully');
        } catch (error) {
          console.error('❌ Error sending email notification:', error);
          emailError = error instanceof Error ? error.message : 'Unknown email error';
          // Don't throw here - we still want to return success if database save worked
        }
      } else {
        console.warn('⚠️  EmailJS not configured. Email notification will not be sent.');
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
  },

  /**
   * Test database connectivity and permissions for debugging
   */
  async testDatabaseConnection() {
    try {
      console.log('🔍 Testing Supabase connection...');
      
      // Test basic connection
      const { data, error } = await supabase
        .from('feedback')
        .select('count(*)')
        .limit(1);

      if (error) {
        console.error('❌ Database connection test failed:', error);
        return {
          success: false,
          error: error.message,
          details: error
        };
      }

      console.log('✅ Database connection test successful');
      return {
        success: true,
        message: 'Database connection working',
        data
      };
    } catch (error) {
      console.error('❌ Database connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  },

  /**
   * Test feedback submission with sample data for debugging
   */
  async testFeedbackSubmission() {
    const testData: FeedbackData = {
      feedbackType: 'general',
      message: 'Test feedback submission from debug function'
    };

    console.log('🧪 Testing feedback submission...');
    return await this.submitFeedback(testData);
  }
}; 