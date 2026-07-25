// Enum translation between eFinSign API vocabulary and local DB enums.

export function mapDocStatusFromEfinsign(s: string | null | undefined): string {
  switch (s) {
    case 'draft': return 'draft';
    case 'pending': return 'sent';
    case 'completed': return 'completed';
    case 'expired': return 'expired';
    case 'declined': return 'declined';
    default: return 'draft';
  }
}

export function mapSignerStatusFromEfinsign(s: string | null | undefined): string {
  switch (s) {
    case 'pending': return 'sent';
    case 'viewed': return 'viewed';
    case 'signed': return 'signed';
    case 'declined': return 'declined';
    default: return 'pending';
  }
}

// eFinSign field types → local field_type enum
export function mapFieldTypeToEfinsign(t: string): string {
  switch (t) {
    case 'initial': return 'initials';
    case 'signature': return 'signature';
    case 'full_name': return 'full_name';
    case 'date': return 'date';
    case 'checkbox': return 'checkbox';
    case 'text': return 'text';
    // stamp/seal → text fallback (unsupported upstream)
    default: return 'text';
  }
}

export function mapFieldTypeFromEfinsign(t: string): string {
  switch (t) {
    case 'initials': return 'initial';
    case 'signature': return 'signature';
    case 'full_name':
    case 'name': return 'full_name';
    case 'date': return 'date';
    case 'checkbox':
    case 'checkmark': return 'checkbox';
    case 'title':
    case 'text': return 'text';
    default: return 'text';
  }
}
