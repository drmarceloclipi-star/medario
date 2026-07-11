export type NotificationChannel = "email" | "whatsapp" | "push";
export type NotificationEvent = "appointment_confirmed" | "profile_updated" | "saved_search_material";
export type NotificationPreference = { email: boolean; whatsapp: boolean; push: boolean };

export function canDeliverNotification(input: { isAccount: boolean; enabled: boolean; channel: NotificationChannel; event: NotificationEvent }) {
  const knownChannel = input.channel === "email" || input.channel === "whatsapp" || input.channel === "push";
  return input.isAccount && input.enabled && knownChannel && (input.event === "appointment_confirmed" || input.event === "profile_updated" || input.event === "saved_search_material");
}
