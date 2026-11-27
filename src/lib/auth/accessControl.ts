export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkEmailAccess(email: string): AccessCheckResult {
  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];

  const rawDomains = process.env.ALLOWED_DOMAINS || process.env.NEXT_PUBLIC_ALLOWED_DOMAINS || '';
  const rawEmails = process.env.ALLOWED_EMAILS || process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '';

  const allowedDomains = rawDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const allowedEmails = rawEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0 && allowedEmails.length === 0) {
    return { allowed: true };
  }

  if (domain && allowedDomains.includes(domain)) {
    return { allowed: true };
  }

  if (allowedEmails.includes(cleanEmail)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Access restricted. Your organization (${domain ? `@${domain}` : 'domain'}) or email (${cleanEmail}) is not authorized for this workspace.`,
  };
}
