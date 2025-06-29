// Supabase Edge Function for running scheduled jobs
// This would be triggered by a cron job in production

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Job types
type JobType = 
  | "community-status-updates"
  | "streak-calculations"
  | "leaderboard-updates"
  | "meeting-cleanup"
  | "notification-cleanup"
  | "meeting-reminders"
  | "community-start-reminders"
  | "streak-warnings"
  | "abandoned-communities"
  | "all";

// Run a specific job
async function runJob(jobType: JobType): Promise<{ success: boolean; message: string }> {
  try {
    let functionName: string;
    
    switch (jobType) {
      case "community-status-updates":
        functionName = "schedule_community_status_updates";
        break;
      case "streak-calculations":
        functionName = "schedule_streak_calculations";
        break;
      case "leaderboard-updates":
        functionName = "schedule_leaderboard_updates";
        break;
      case "meeting-cleanup":
        functionName = "schedule_meeting_cleanup";
        break;
      case "notification-cleanup":
        functionName = "schedule_notification_cleanup";
        break;
      case "meeting-reminders":
        functionName = "generate_meeting_reminders";
        break;
      case "community-start-reminders":
        functionName = "generate_community_start_reminders";
        break;
      case "streak-warnings":
        functionName = "generate_streak_warnings";
        break;
      case "abandoned-communities":
        functionName = "check_abandoned_communities";
        break;
      case "all":
        // Run all jobs sequentially
        await runJob("community-status-updates");
        await runJob("streak-calculations");
        await runJob("leaderboard-updates");
        await runJob("meeting-cleanup");
        await runJob("notification-cleanup");
        await runJob("meeting-reminders");
        await runJob("community-start-reminders");
        await runJob("streak-warnings");
        await runJob("abandoned-communities");
        return { success: true, message: "All jobs completed successfully" };
      default:
        return { success: false, message: `Unknown job type: ${jobType}` };
    }
    
    // Execute the database function
    const { error } = await supabase.rpc(functionName);
    
    if (error) {
      console.error(`Error running job ${jobType}:`, error);
      return { success: false, message: `Error running job ${jobType}: ${error.message}` };
    }
    
    return { success: true, message: `Job ${jobType} completed successfully` };
  } catch (error) {
    console.error(`Error running job ${jobType}:`, error);
    return { success: false, message: `Error running job ${jobType}: ${error.message}` };
  }
}

// Main handler function
serve(async (req) => {
  try {
    // Parse request
    const url = new URL(req.url);
    const jobType = url.searchParams.get("job") as JobType || "all";
    
    console.log(`Running scheduled job: ${jobType}`);
    
    // Run the requested job
    const result = await runJob(jobType);
    
    // Return response
    return new Response(
      JSON.stringify(result),
      { 
        headers: { "Content-Type": "application/json" },
        status: result.success ? 200 : 500
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, message: `Unexpected error: ${error.message}` }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});