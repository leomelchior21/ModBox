import type { QuickInsertGroup, QuickInsertToken } from '../interpreter/core/adapter';

/* ============================================================================
   MODBOX — QUICK INSERT CHIPS
   Tap-to-insert helpers for tablet typing. Only the tokens that matter for the
   current mission are shown, clustered by personality so a long bar never feels
   like a wall of buttons (spec §27).
   ========================================================================== */

const GROUP_ORDER: QuickInsertGroup[] = ['type', 'value', 'logic', 'action', 'mod'];

const GROUP_LABEL: Record<QuickInsertGroup, string> = {
  type: 'TYPES',
  value: 'VALUES',
  logic: 'LOGIC',
  action: 'ACTIONS',
  mod: 'MODS',
};

export function QuickInsertBar({
  tokens,
  onInsert,
}: {
  tokens: QuickInsertToken[];
  onInsert: (token: QuickInsertToken) => void;
}): JSX.Element {
  const clusters = GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABEL[key],
    tokens: tokens.filter((token) => token.group === key),
  })).filter((cluster) => cluster.tokens.length > 0);

  // anything an adapter leaves untagged still gets a home
  const loose = tokens.filter((token) => !token.group);
  if (loose.length) clusters.push({ key: 'mod', label: 'INSERT', tokens: loose });

  return (
    <section className="quickinsert" aria-label="Quick insert">
      <div className="quickinsert__head"><h3><span aria-hidden="true">&lt;/&gt;</span> QUICK INSERT</h3><span>Tap to add code</span></div>
    <div className="chips" role="group" aria-label="Code snippets">
      {clusters.map((cluster) => (
        <div className="chips__group" key={cluster.key}>
          <span className="chips__groupLabel" aria-hidden="true">
            {cluster.label}
          </span>
          {cluster.tokens.map((token) => (
            <button
              key={token.label}
              type="button"
              className={`chip chip--${token.group ?? 'mod'}`}
              title={token.hint ? `${token.hint} → ${token.insert}` : token.insert}
              onClick={() => onInsert(token)}
            >
              {token.label}
            </button>
          ))}
        </div>
      ))}
    </div>
    </section>
  );
}
