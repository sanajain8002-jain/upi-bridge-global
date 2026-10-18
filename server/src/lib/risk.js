// Transparent, configurable rule-based risk scoring (no AI API required).
// This is a demonstration aid. It flags transfers for a verification step; it does not accuse
// anyone of fraud and cannot guarantee fraud prevention.

export const DEFAULT_RISK_RULES = {
  large_multiple: 3, // amount > N x user's average successful transfer
  large_min_history: 3, // history needed before the comparison applies
  large_absolute_inr: 100000,
  velocity_window_min: 10,
  velocity_count: 3,
  failed_window_hours: 24,
  failed_count: 2,
  recipient_identifiers_30d: 3,
  medium_threshold: 25,
  high_threshold: 55,
};

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * history: the user's previous transactions, each { amount_inr, status, created_at, recipient_name,
 * recipient_identifier }. allHistoryForIdentifier: any transactions (any user) that used the same
 * identifier, each { recipient_name } - used for the inconsistent-recipient rule.
 */
export function assessRisk({ amountInr, recipientName, identifier, history, identifierHistory = [], now = Date.now(), rules = DEFAULT_RISK_RULES }) {
  const reasons = [];
  let score = 0;
  const add = (points, code, text) => {
    score += points;
    reasons.push({ code, points, text });
  };

  const successful = history.filter((t) => t.status === 'successful');
  if (successful.length >= rules.large_min_history) {
    const avg = successful.reduce((s, t) => s + t.amount_inr, 0) / successful.length;
    if (amountInr > avg * rules.large_multiple)
      add(40, 'LARGE_VS_HISTORY', `This amount (₹${amountInr.toLocaleString('en-IN')}) is more than ${rules.large_multiple}× your demo average of ₹${Math.round(avg).toLocaleString('en-IN')}.`);
  }
  if (amountInr >= rules.large_absolute_inr)
    add(25, 'LARGE_ABSOLUTE', `Amounts of ₹${rules.large_absolute_inr.toLocaleString('en-IN')} or more get an extra check.`);

  const windowMs = rules.velocity_window_min * 60 * 1000;
  const recent = history.filter((t) => now - Date.parse(t.created_at) <= windowMs).length;
  if (recent >= rules.velocity_count)
    add(recent >= rules.velocity_count + 2 ? 45 : 30, 'VELOCITY', `${recent} transfers were started in the last ${rules.velocity_window_min} minutes.`);

  const failedMs = rules.failed_window_hours * 3600 * 1000;
  const failed = history.filter((t) => t.status === 'failed' && now - Date.parse(t.created_at) <= failedMs).length;
  if (failed >= rules.failed_count)
    add(30, 'REPEATED_FAILURES', `${failed} failed attempts in the last ${rules.failed_window_hours} hours.`);

  const sameIdentDifferentName = identifierHistory.some((t) => norm(t.recipient_name) !== norm(recipientName));
  if (sameIdentDifferentName)
    add(35, 'INCONSISTENT_RECIPIENT', 'This payment identifier was previously used with a different recipient name.');

  const monthMs = 30 * 24 * 3600 * 1000;
  const identsForName = new Set(
    history
      .filter((t) => norm(t.recipient_name) === norm(recipientName) && now - Date.parse(t.created_at) <= monthMs)
      .map((t) => t.recipient_identifier)
  );
  identsForName.add(identifier);
  if (identsForName.size >= rules.recipient_identifiers_30d)
    add(15, 'MANY_IDENTIFIERS', `${identsForName.size} different payment identifiers used for this recipient name in 30 days.`);

  const level = score >= rules.high_threshold ? 'high' : score >= rules.medium_threshold ? 'medium' : 'low';
  const suggestion = {
    low: 'No extra step suggested. Proceed as normal.',
    medium: 'Suggested: confirm the recipient details with the recipient through a channel you already trust before sending.',
    high: 'Suggested: pause and verify the recipient and amount directly with them. A reviewer will look at this demo payment.',
  }[level];

  return {
    score,
    level,
    reasons,
    suggestedStep: suggestion,
    engine: 'rule-based',
    note: 'Automated rule-based check for demonstration. It highlights things worth double-checking and is not an accusation or a guarantee of fraud prevention.',
  };
}
