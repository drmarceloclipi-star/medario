export function shouldApplyAccountProfile(active: boolean, generation: number, currentGeneration: number) {
  return active && generation === currentGeneration;
}

export async function deleteAccountAndEndSession(
  deleteAccount: (password?: string) => Promise<void>,
  signOut: () => Promise<void>,
  password?: string,
) {
  await deleteAccount(password);
  try {
    await signOut();
  } catch {
    // Server-side deletion already succeeded. Auth state listener/token expiry
    // will close the local session; cleanup failure must not report deletion failure.
  }
}
