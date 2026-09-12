import { useEffect, useRef } from 'react';
import { codeBlocks, moveCodeBlock } from '../editor/modEditing';

export function CodeOrder({ code, onChange, onClose }: { code: string; onChange: (code: string) => void; onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const blocks = codeBlocks(code);
  const drag = useRef<number | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const move = (index: number, direction: -1 | 1) => onChange(moveCodeBlock(code, index, direction));
  return <dialog ref={dialog} className="mission-dialog code-order" aria-label="Arrange code" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2>ARRANGE CODE</h2><button onClick={onClose} aria-label="Close code arranger">✕</button></header>
    <p>Drag a line within its section, or use the arrows. Rules move as one block. Order affects what your code does; undo is available in the editor.</p>
    {!blocks ? <p>Finish the incomplete code first so its blocks can be moved safely.</p> : blocks.map((block, i) => <div key={`${i}-${block.statement.kind}`}>
      {i === 0 || blocks[i - 1].group !== block.group ? <h3>{['VARIABLES & SWITCHES', 'UPDATES', 'FLIGHT LOG OUTPUT', 'RULES'][block.group]}</h3> : null}
      <div className="code-order__block" draggable onDragStart={e => { drag.current = i; e.dataTransfer.setData('text/plain', String(i)); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = drag.current; if (from === null || blocks.slice(Math.min(i, from), Math.max(i, from) + 1).some(b => b.group !== block.group)) return; let result = code; const direction = i > from ? 1 : -1; for (let n = from; n !== i; n += direction) result = moveCodeBlock(result, n, direction); onChange(result); drag.current = null; }}>
        <span aria-hidden="true">⠿</span><code>{block.text}</code><button disabled={blocks[i - 1]?.group !== block.group} onClick={() => move(i, -1)} aria-label={`Move statement ${i + 1} up`}>↑</button><button disabled={blocks[i + 1]?.group !== block.group} onClick={() => move(i, 1)} aria-label={`Move statement ${i + 1} down`}>↓</button>
      </div>
    </div>)}
  </dialog>;
}
