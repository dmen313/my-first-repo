import React, { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { REORDER_DRAFT_PICKS } from '../graphql/client';
import './DraftOrderEditor.css';

const DraftOrderEditor = ({ league, season, owners, onClose, onSave }) => {
  const [currentOrder, setCurrentOrder] = useState([...owners]);
  const [isReordering, setIsReordering] = useState(false);
  
  const [reorderDraftPicksMutation] = useMutation(REORDER_DRAFT_PICKS);

  // Move owner up in the order
  const moveOwnerUp = useCallback((index) => {
    if (index > 0) {
      const newOrder = [...currentOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setCurrentOrder(newOrder);
    }
  }, [currentOrder]);

  // Move owner down in the order
  const moveOwnerDown = useCallback((index) => {
    if (index < currentOrder.length - 1) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setCurrentOrder(newOrder);
    }
  }, [currentOrder]);

  // Save the new draft order
  const handleSave = useCallback(async () => {
    try {
      setIsReordering(true);
      
      console.log('🔄 Reordering draft with new owner order:', currentOrder);
      
      const { data } = await reorderDraftPicksMutation({
        variables: {
          league,
          season,
          owners: currentOrder
        }
      });
      
      console.log('✅ Draft reordered successfully');
      onSave(data.reorderDraftPicks);
      onClose();
      
    } catch (error) {
      console.error('❌ Error reordering draft:', error);
      alert(`Failed to reorder draft: ${error.message}`);
    } finally {
      setIsReordering(false);
    }
  }, [league, season, currentOrder, reorderDraftPicksMutation, onSave, onClose]);

  // Reset to original order
  const handleReset = useCallback(() => {
    setCurrentOrder([...owners]);
  }, [owners]);

  const hasChanges = JSON.stringify(currentOrder) !== JSON.stringify(owners);

  return (
    <div className="draft-order-editor-overlay">
      <div className="draft-order-editor">
        <div className="draft-order-header">
          <h3>Edit Draft Order</h3>
          <button 
            className="close-button"
            onClick={onClose}
            disabled={isReordering}
          >
            ×
          </button>
        </div>
        
        <div className="draft-order-content">
          <p className="draft-order-description">
            Reorder the owners to change the draft order. The first owner will get picks 1, 5, 9, etc. 
            The second owner will get picks 2, 6, 10, etc. (snake draft format).
          </p>
          
          <div className="owner-list">
            {currentOrder.map((owner, index) => (
              <div key={owner} className="owner-item">
                <div className="owner-info">
                  <span className="owner-position">{index + 1}.</span>
                  <span className="owner-name">{owner}</span>
                  <span className="owner-picks">
                    Picks: {Array.from({ length: 3 }, (_, i) => {
                      const pickNum = index + 1 + (i * currentOrder.length);
                      return pickNum <= 12 * currentOrder.length ? pickNum : null;
                    }).filter(Boolean).join(', ')}...
                  </span>
                </div>
                
                <div className="owner-controls">
                  <button
                    className="move-button"
                    onClick={() => moveOwnerUp(index)}
                    disabled={index === 0 || isReordering}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="move-button"
                    onClick={() => moveOwnerDown(index)}
                    disabled={index === currentOrder.length - 1 || isReordering}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="draft-order-actions">
          <button
            className="reset-button"
            onClick={handleReset}
            disabled={!hasChanges || isReordering}
          >
            Reset
          </button>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={isReordering}
          >
            Cancel
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={!hasChanges || isReordering}
          >
            {isReordering ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftOrderEditor;
