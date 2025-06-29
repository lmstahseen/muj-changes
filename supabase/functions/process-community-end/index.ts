// Supabase Edge Function for processing community end and distributing earnings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Parse request body
    const { communityId } = await req.json();
    
    if (!communityId) {
      return new Response(
        JSON.stringify({ success: false, message: "Community ID is required" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    console.log(`Processing end of community: ${communityId}`);
    
    // Call the database function to process community end
    const { data, error } = await supabase.rpc("process_community_end", {
      p_community_id: communityId
    });
    
    if (error) {
      console.error("Error processing community end:", error);
      return new Response(
        JSON.stringify({ success: false, message: `Error: ${error.message}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Community processed successfully",
        result: data
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