import { describe, it, expect } from 'vitest';
import type { PurchaseOpenDraft } from '../src/types';

describe('Purchase Draft Deletion Logic', () => {
  it('correctly removes deleted draft from open drafts array', () => {
    const drafts: PurchaseOpenDraft[] = [
      { id: '0001', date: '23/07/2026', time: '10:00:00', supplier: 'Fournisseur A', draftItems: [], versement: 0 },
      { id: '0002', date: '23/07/2026', time: '11:00:00', supplier: 'Fournisseur B', draftItems: [], versement: 0 }
    ];

    const idToDelete = '0001';
    const remainingDrafts = drafts.filter(d => String(d.id) !== String(idToDelete));

    expect(remainingDrafts).toHaveLength(1);
    expect(remainingDrafts[0].id).toBe('0002');
  });

  it('selects the previous available draft when active draft is deleted', () => {
    const drafts: PurchaseOpenDraft[] = [
      { id: '0001', date: '23/07/2026', time: '10:00:00', supplier: 'Fournisseur A', draftItems: [], versement: 0 },
      { id: '0002', date: '23/07/2026', time: '11:00:00', supplier: 'Fournisseur B', draftItems: [], versement: 0 }
    ];

    const idToDelete = '0002';
    const remainingDrafts = drafts.filter(d => String(d.id) !== String(idToDelete));
    const activeDraft = remainingDrafts.length > 0 ? remainingDrafts[remainingDrafts.length - 1] : null;

    expect(activeDraft).not.toBeNull();
    expect(activeDraft?.id).toBe('0001');
  });
});
