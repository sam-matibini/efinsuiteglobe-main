export const NOTIFICATION_EVENT_LIST = [
  { event: "team.invite", label: "Team invitations", description: "Invitation link sent to the person you invite." },
  { event: "team.welcome", label: "Welcome message", description: "Sent when someone joins your workspace." },
  { event: "case.decision", label: "Case decisions", description: "When a case is approved or rejected." },
  { event: "alert.opened", label: "Monitoring alerts", description: "When a new monitoring alert opens." },
  { event: "screening.hit", label: "New screening matches", description: "When screening finds a possible match." },
  { event: "report.filed", label: "Report filed", description: "Confirmation once a report is marked as filed." },
] as const;

export const NOTIFICATION_EVENTS: Record<string, string> = Object.fromEntries(
  NOTIFICATION_EVENT_LIST.map((e) => [e.event, e.label]),
);
NOTIFICATION_EVENTS["test"] = "Test message";
