import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

const BRAND_NAME = "efinsuite Globe";
const BRAND_EMAIL = "info@efinsuite.com";

const getBrandedFooter = () => `
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    <p>© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
    <p>efinsuite.com · Winnipeg, MB, Canada</p>
  </div>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || BRAND_EMAIL;
    const resendFromName = Deno.env.get("RESEND_FROM_NAME") || BRAND_NAME;
    
    // Verify the user with anon key
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    
    // Get full user for metadata
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, role, organizationId, organizationName }: InvitationRequest = await req.json();

    if (!email || !organizationId || !organizationName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to create invitation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if invitation already exists (if so, we resend instead of creating a duplicate)
    const { data: existingInvitation } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, token, role, invited_by")
      .eq("organization_id", organizationId)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();

    // Check if user is already a member
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", existingProfile.user_id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ 
            error: "This person is already a team member. You can update their role from the Team Members list instead.",
            code: "ALREADY_MEMBER"
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use existing invitation or create a new one
    const invitation = existingInvitation
      ? existingInvitation
      : await (async () => {
          const { data, error: insertError } = await supabaseAdmin
            .from("organization_invitations")
            .insert({
              organization_id: organizationId,
              email: email.toLowerCase(),
              role: role || "member",
              invited_by: user.id,
            })
            .select("id, token, role, invited_by, email")
            .single();

          if (insertError || !data) {
            console.error("Insert error:", insertError);
            throw new Error("Failed to create invitation");
          }

          return data;
        })();

    // Get inviter's name (use original inviter if resending)
    const inviterUserId = invitation.invited_by || user.id;
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", inviterUserId)
      .single();

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team member";

    // Generate invitation link
    const appUrl = Deno.env.get("APP_URL") || "https://efinsuite.com";
    const inviteLink = `${appUrl}/accept-invite?token=${invitation.token}`;

    // Send email using Resend API
    if (!resendApiKey) {
      // Cleanup newly-created invitations so the user can retry after configuration is fixed
      if (!existingInvitation) {
        await supabaseAdmin.from("organization_invitations").delete().eq("id", invitation.id);
      }
      return new Response(
        JSON.stringify({
          error: "Email service is not configured (missing RESEND_API_KEY)",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">You're Invited!</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${BRAND_NAME}.
          </p>
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
            You've been assigned the role of <strong style="color: #2563eb;">${invitation.role || role || "member"}</strong>.
          </p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <div style="background-color: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            ⏰ This invitation will expire in 7 days.
          </p>
        </div>
        
        <p style="color: #64748b; font-size: 13px; text-align: center;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
        
        ${getBrandedFooter()}
      </div>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${resendFromName} <${resendFromEmail}>`,
        to: [email],
        subject: `You've been invited to join ${organizationName}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend email error:", errorText);

      // Cleanup newly-created invitations so the user can retry
      if (!existingInvitation) {
        await supabaseAdmin.from("organization_invitations").delete().eq("id", invitation.id);
      }

      return new Response(
        JSON.stringify({
          error: "Invitation email could not be sent. Verify the sender domain in Resend (resend.com/domains) or set RESEND_FROM_EMAIL to a verified sender.",
          details: errorText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      existingInvitation
        ? "Invitation email resent successfully via Resend to:"
        : "Invitation email sent successfully via Resend to:",
      email
    );

    return new Response(
      JSON.stringify({
        success: true,
        resent: Boolean(existingInvitation),
        invitation: { id: invitation.id, email: email.toLowerCase() },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
