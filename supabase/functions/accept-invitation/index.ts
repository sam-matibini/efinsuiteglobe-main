import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AcceptRequest {
  token: string;
  password: string;
  full_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password, full_name }: AcceptRequest = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Look up the invitation
    const { data: invitation, error: invErr } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, organization_id, email, role, status, expires_at, invited_by")
      .eq("token", token)
      .single();

    if (invErr || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "accepted") {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "This invitation has been cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = invitation.email.toLowerCase();

    // 2. Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Only update password if a real password was provided (not the "existing-user" marker)
      if (password !== "existing-user") {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
        if (updateErr) {
          console.error("Update user error:", updateErr);
          return new Response(
            JSON.stringify({ error: "Failed to update account: " + updateErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      // Create new user (auto-confirmed via admin API)
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr || !newUser.user) {
        console.error("Create user error:", createErr);
        return new Response(
          JSON.stringify({ error: "Failed to create account: " + (createErr?.message || "Unknown error") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Create profile
      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        email,
        full_name: full_name || null,
      }, { onConflict: "user_id" });
    }

    // 3. Add org membership (skip if already a member)
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", userId)
      .single();

    if (!existingMember) {
      const { error: memberErr } = await supabaseAdmin
        .from("organization_members")
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role || "member",
          joined_at: new Date().toISOString(),
        });

      if (memberErr) {
        console.error("Member insert error:", memberErr);
        return new Response(
          JSON.stringify({ error: "Failed to add to organization: " + memberErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Cancel any older accepted/pending invitations for this email+org to avoid unique constraint violation
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "cancelled" })
      .eq("organization_id", invitation.organization_id)
      .eq("email", email)
      .neq("id", invitation.id)
      .in("status", ["pending", "accepted"]);

    // 5. Mark this invitation as accepted
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // 5. Get org name for response
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        email,
        organization_name: org?.name || "the organization",
        organization_id: invitation.organization_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("accept-invitation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
