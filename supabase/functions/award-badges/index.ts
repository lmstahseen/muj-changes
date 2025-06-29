// Supabase Edge Function for checking and awarding badges

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Parse request body
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: "User ID is required" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    console.log(`Checking badges for user: ${userId}`);
    
    // Call the database function to award badges
    const { error } = await supabase.rpc("award_badges", {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Error awarding badges:", error);
      return new Response(
        JSON.stringify({ success: false, message: `Error: ${error.message}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Get the user's current badges
    const { data: badges, error: badgesError } = await supabase.rpc("get_user_badges", {
      p_user_id: userId
    });
    
    if (badgesError) {
      console.error("Error getting badges:", badgesError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Badges checked and awarded successfully",
        badges: badges || []
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, message: `Unexpected error: ${error.message}` }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});