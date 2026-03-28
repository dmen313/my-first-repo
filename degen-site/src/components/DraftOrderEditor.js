import React, { useState, useCallback } from 'react';
import { USE_DIRECT_DYNAMODB } from '../config/dataSource';
import { useMutation } from '@apollo/client';
import { REORDER_DRAFT_PICKS } from '../graphql/client';
import './DraftOrderEditor.css';

const DraftOrderEditor = ({ league, season, owners, onClose, onSave }) => {
  const [currentOrder, setCurrentOrder] = useState([...owners]);
  const [isReordering, setIsReordering] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomRounds, setRandomRounds] = useState('1');
  const [randomHistory, setRandomHistory] = useState([]);
  
  // Conditionally use mutation only if not using direct DynamoDB
  const [reorderDraftPicksMutation] = useMutation(REORDER_DRAFT_PICKS, { skip: USE_DIRECT_DYNAMODB });

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

  const handleRandomize = useCallback(() => {
    if (currentOrder.length < 2) {
      alert('At least two owners are required to randomize the draft order.');
      return;
    }

    if (isRandomizing || isReordering) {
      return;
    }

    const parsedRounds = parseInt(randomRounds, 10);
    const rounds = Number.isNaN(parsedRounds) ? 1 : Math.min(Math.max(parsedRounds, 1), 100);

    setIsRandomizing(true);

    try {
      const shuffle = (order) => {
        const arr = [...order];
        for (let i = arr.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      let nextOrder = [...currentOrder];
      const results = [];

      for (let round = 1; round <= rounds; round += 1) {
        nextOrder = shuffle(nextOrder);
        results.push(
          `Round ${round}: ${nextOrder
            .map((owner, index) => `${index + 1}) ${owner}`)
            .join(' → ')}`
        );
      }

      setCurrentOrder(nextOrder);
      setRandomHistory((prev) => [...results, ...prev]);
    } finally {
      setIsRandomizing(false);
    }
  }, [currentOrder, isRandomizing, isReordering, randomRounds]);

  // Save the new draft order
  const handleSave = useCallback(async () => {
    try {
      setIsReordering(true);
      
      console.log('🔄 Reordering draft with new owner order:', currentOrder);
      
      let reorderedPicks;
      
      if (USE_DIRECT_DYNAMODB) {
        // Use DynamoDB service directly
        const { reorderDraftPicks } = await import('../services/dynamoDBService');
        reorderedPicks = await reorderDraftPicks(league, season, currentOrder);
        console.log('✅ Draft reordered successfully via DynamoDB');
      } else {
        // Use GraphQL mutation
        const { data } = await reorderDraftPicksMutation({
          variables: {
            league,
            season,
            owners: currentOrder
          }
        });
        reorderedPicks = data.reorderDraftPicks;
        console.log('✅ Draft reordered successfully via GraphQL');
      }
      
      onSave(reorderedPicks);
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

          <div className="randomizer-section">
            <div className="randomizer-header">
              <strong>Randomize draft order</strong>
              <span className="randomizer-hint">Enter how many rounds of shuffling you want to apply.</span>
            </div>
            <div className="randomizer-controls">
              <label htmlFor="randomRounds">
                Rounds
                <input
                  id="randomRounds"
                  type="number"
                  min="1"
                  max="100"
                  value={randomRounds}
                  onChange={(e) => setRandomRounds(e.target.value)}
                  disabled={isRandomizing || isReordering}
                />
              </label>
              <button
                className="randomize-button"
                onClick={handleRandomize}
                disabled={isRandomizing || isReordering}
              >
                {isRandomizing ? 'Randomizing...' : 'Randomize Order'}
              </button>
            </div>
            {randomHistory.length > 0 && (
              <div className="randomizer-history">
                <span className="randomizer-history-title">Randomized orders:</span>
                <div className="randomizer-history-list">
                  {randomHistory.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="randomizer-history-item">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
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
            disabled={!hasChanges || isReordering || isRandomizing}
          >
            Reset
          </button>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={isReordering || isRandomizing}
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
