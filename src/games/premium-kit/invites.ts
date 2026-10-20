/**
 * Mod invites: moments where a game suggests one concrete change to the student's code.
 * A loss offers help, a win offers a tougher or stranger challenge, and a struggle mid-game offers a quick tweak.
 * Each game writes its own invites, so the coaching matches how that game is played.
 */
export type InviteMoment = 'lose' | 'win' | 'struggle';
export interface ModInvite {
  /** Stable id, so the same nudge is not repeated within a session. */
  id: string;
  icon: string; title: string; reason: string;
  /** Canonical C# subset, translated to the student's language before it is shown or inserted. */
  code: string;
  tone: 'help' | 'challenge' | 'style';
}
/** Picks invites whose code would actually change something, without repeats, at most `limit`. */
export function freshInvites(list: readonly ModInvite[] | undefined, seen: ReadonlySet<string>, limit: number): ModInvite[] {
  return (list ?? []).filter(i => !seen.has(i.id)).slice(0, limit);
}
