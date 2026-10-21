import type { InviteMoment, ModInvite } from './invites';
import './result.css';

/** A suggestion is offered only when its mod is available to the student; `target` names that mod's id. */
export interface GameInvite extends ModInvite { target: string }
/** Keeps invites whose mod the student can use right now (progressive campaigns unlock mods mission by mission). */
export const usableInvites = (list: readonly GameInvite[], unlocked: readonly string[]) => list.filter(i => unlocked.includes(i.target));

/** Compact "try a mod" cards for game screens with their own overlays. Codes arrive already in the student's language. */
export function InviteList({ invites, moment, onInvite }: { invites: readonly ModInvite[]; moment: InviteMoment; onInvite(invite: ModInvite): void }): JSX.Element | null {
  if (!invites.length) return null;
  return <div className="result__invites invite-list" aria-label="Try a mod">
    <b>{moment === 'win' ? 'LEVEL UP WITH A MOD' : 'TRY A MOD'}</b>
    {invites.map(invite => <button key={invite.id} className={`result__invite result__invite--${invite.tone}`} onClick={() => onInvite(invite)}>
      <i aria-hidden="true">{invite.icon}</i><span><strong>{invite.title}</strong><small>{invite.reason}</small><code>{invite.code}</code></span><em>{moment === 'win' ? 'ADD + NEXT' : 'ADD + RETRY'}</em>
    </button>)}
  </div>;
}
