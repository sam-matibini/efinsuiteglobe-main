import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FieldUpdate {
  id: string;
  filled_value: string | null;
}

interface FieldInsert {
  field_type: "signature" | "initial";
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  page_number: number;
  is_required?: boolean;
}

interface RequestPayload {
  action: "get" | "submit" | "add-field";
  signerId: string;
  fields?: FieldUpdate[];
  field?: FieldInsert;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, signerId, fields, field }: RequestPayload = body;

    console.log("[docsign-signer-portal] Received request:", JSON.stringify({ action, signerId, hasFields: !!fields, hasField: !!field }));

    if (!signerId) {
      console.error("[docsign-signer-portal] Missing signerId in body:", JSON.stringify(body));
      return new Response(JSON.stringify({ error: "signerId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to fetch the signer record directly by ID
    let signer: any = null;
    const { data: directSigner, error: signerErr } = await supabase
      .from("document_signers")
      .select("*")
      .eq("id", signerId)
      .maybeSingle();

    if (directSigner) {
      signer = directSigner;
    } else {
      // FALLBACK: The signerId might actually be a document_id (legacy links).
      // Try to find the first pending/sent signer for this document.
      console.log("[docsign-signer-portal] Direct signer lookup failed, trying document_id fallback:", signerId);
      const { data: fallbackSigners } = await supabase
        .from("document_signers")
        .select("*")
        .eq("document_id", signerId)
        .order("signing_order", { ascending: true })
        .limit(1);

      if (fallbackSigners && fallbackSigners.length > 0) {
        signer = fallbackSigners[0];
        console.log("[docsign-signer-portal] Fallback found signer:", signer.id, signer.email);
      }
    }

    if (!signer) {
      console.error("Signer lookup error:", signerErr, "| signerId:", signerId);
      return new Response(JSON.stringify({ error: "Signer not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const documentId = signer.document_id;
    const resolvedSignerId = signer.id;

    // Fetch the document
    const { data: document, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !document) {
      console.error("Document lookup error:", docErr);
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch all signers for the document
    const { data: signers } = await supabase
      .from("document_signers")
      .select("*")
      .eq("document_id", documentId)
      .order("signing_order", { ascending: true });

    // Fetch all fields for the document
    const { data: docFields } = await supabase
      .from("document_fields")
      .select("*")
      .eq("document_id", documentId)
      .order("page_number", { ascending: true });

    let effectiveFields = docFields || [];

    // Backward-compat fallback:
    // if a document has exactly one signer and no fields assigned to them,
    // auto-assign unassigned/unfilled fields so click-to-sign works.
    if (action === "get") {
      const signerHasAssignedFields = effectiveFields.some((f: any) => f.assigned_signer_id === resolvedSignerId);
      const singleSignerFlow = (signers || []).length === 1;

      if (!signerHasAssignedFields && singleSignerFlow) {
        const { error: autoAssignError } = await supabase
          .from("document_fields")
          .update({ assigned_signer_id: resolvedSignerId })
          .eq("document_id", documentId)
          .is("assigned_signer_id", null)
          .is("filled_value", null);

        if (autoAssignError) {
          console.error("[docsign-signer-portal] Auto-assign fallback failed:", autoAssignError);
        } else {
          const { data: refreshedFields } = await supabase
            .from("document_fields")
            .select("*")
            .eq("document_id", documentId)
            .order("page_number", { ascending: true });

          effectiveFields = refreshedFields || effectiveFields;
        }
      }
    }

    // ===== ADD-FIELD: allow signer to place their own signature/initial field =====
    if (action === "add-field") {
      if (!field) {
        return new Response(JSON.stringify({ error: "field payload is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!["signature", "initial"].includes(field.field_type)) {
        return new Response(JSON.stringify({ error: "Only signature/initial fields can be added by signer" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (signer.status === "signed") {
        return new Response(JSON.stringify({ error: "Signing session already submitted" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: insertedField, error: insertErr } = await supabase
        .from("document_fields")
        .insert({
          document_id: documentId,
          field_type: field.field_type,
          position_x: field.position_x,
          position_y: field.position_y,
          width: field.width,
          height: field.height,
          page_number: field.page_number,
          is_required: field.is_required ?? true,
          assigned_signer_id: resolvedSignerId,
        })
        .select("*")
        .single();

      if (insertErr || !insertedField) {
        console.error("[docsign-signer-portal] add-field error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to add signature field" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      await supabase.from("document_audit_logs").insert({
        document_id: documentId,
        action: "signer_field_added",
        actor_type: "signer",
        actor_email: signer.email,
        details: { signer_id: resolvedSignerId, field_id: insertedField.id, field_type: insertedField.field_type },
      });

      return new Response(JSON.stringify({ success: true, field: insertedField }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ===== GET: Return document, signer info, fields =====
    if (action === "get") {
      // Mark as viewed if not already
      if (!signer.viewed_at) {
        await supabase
          .from("document_signers")
          .update({ viewed_at: new Date().toISOString(), status: "viewed" })
          .eq("id", resolvedSignerId);

        // Audit log
        await supabase.from("document_audit_logs").insert({
          document_id: documentId,
          action: "document_viewed",
          actor_type: "signer",
          actor_email: signer.email,
          details: { signer_id: resolvedSignerId },
        });
      }

      return new Response(
        JSON.stringify({
          document,
          signer,
          signers: signers || [],
          fields: effectiveFields,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ===== SUBMIT: Save filled values for this signer's fields =====
    if (action === "submit") {
      // Update each field if any were provided
      if (fields && fields.length > 0) {
        for (const f of fields) {
          await supabase
            .from("document_fields")
            .update({ filled_value: f.filled_value, filled_at: new Date().toISOString() })
            .eq("id", f.id)
            .eq("assigned_signer_id", resolvedSignerId); // security: only update fields assigned to this signer
        }
      }

      // Mark the signer as signed
      await supabase
        .from("document_signers")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
        })
        .eq("id", resolvedSignerId);

      // Audit log
      await supabase.from("document_audit_logs").insert({
        document_id: documentId,
        action: "document_signed",
        actor_type: "signer",
        actor_email: signer.email,
        details: { signer_id: resolvedSignerId, fields_count: fields?.length || 0 },
      });

      // Get document owner info for notifications
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", document.owner_id)
        .maybeSingle();

      // Helper to send notification email via SendGrid
      const sendNotificationEmail = async (to: string, subject: string, html: string) => {
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/resend-integration`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                action: "send-email",
                to,
                subject,
                message: subject,
                html,
              }),
            }
          );
        } catch (emailErr) {
          console.error("[docsign-signer-portal] Notification email error (non-blocking):", emailErr);
        }
      };

      // Notify document owner that this signer has signed
      if (ownerProfile?.email) {
        const signerName = signer.name || signer.email;
        await sendNotificationEmail(
          ownerProfile.email,
          `"${document.title}" — ${signerName} has signed`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Signature Received</h2>
            <p>Hi ${ownerProfile.full_name || 'there'},</p>
            <p><strong>${signerName}</strong> (${signer.email}) has signed <strong>"${document.title}"</strong>.</p>
            <p style="color: #666; font-size: 14px;">You will be notified when all signers have completed signing.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">Powered by eFinsuite Globe</p>
          </div>`
        );
      }

      // Check if all signers have signed
      const { data: allSigners } = await supabase
        .from("document_signers")
        .select("id, status, email, signing_order")
        .eq("document_id", documentId)
        .order("signing_order", { ascending: true });

      const allSigned = (allSigners || []).every((s: any) => s.status === "signed");

      if (allSigned) {
        // All signers completed - trigger document finalization
        await supabase
          .from("documents")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", documentId);

        await supabase.from("document_audit_logs").insert({
          document_id: documentId,
          action: "document_completed",
          actor_type: "system",
          details: { completed_by: "all_signers" },
        });

        // Notify owner that document is fully completed
        if (ownerProfile?.email) {
          const signerList = (allSigners || []).map((s: any) => s.email).join(", ");
          await sendNotificationEmail(
            ownerProfile.email,
            `✅ "${document.title}" — All signatures completed`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Document Fully Signed</h2>
              <p>Hi ${ownerProfile.full_name || 'there'},</p>
              <p>All signers have completed signing <strong>"${document.title}"</strong>.</p>
              <p><strong>Signers:</strong> ${signerList}</p>
              <p>The signed document is now available for download in your DocSign dashboard.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 12px;">Powered by eFinsuite Globe</p>
            </div>`
          );
        }

        // Trigger PDF flattening via finalize-document edge function
        try {
          console.log(`[docsign-signer-portal] Triggering finalize-document for ${documentId}`);
          const finalizeResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/finalize-document`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ documentId }),
            }
          );
          const finalizeResult = await finalizeResponse.json();
          console.log(`[docsign-signer-portal] Finalize result:`, finalizeResult);
        } catch (finalizeErr) {
          console.error(`[docsign-signer-portal] Finalize error (non-blocking):`, finalizeErr);
        }
      } else {
        const pendingSigners = (allSigners || []).filter((s: any) => s.status !== "signed");
        const currentSignerOrder = (allSigners || []).find((s: any) => s.id === resolvedSignerId)?.signing_order || 1;
        const nextSigner = pendingSigners.find((s: any) => s.signing_order === currentSignerOrder + 1);
        
        if (nextSigner) {
          console.log(`[docsign-signer-portal] Next signer to notify: ${nextSigner.email} (order ${nextSigner.signing_order})`);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("docsign-signer-portal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
