import React, { useState, useEffect } from 'react';

const SurvivorCountdown = ({ lockedAt, tournamentDay }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!lockedAt) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const diff = new Date(lockedAt).getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockedAt]);

  if (!lockedAt) {
    return (
      <div className="survivor-countdown tbd">
        <span className="countdown-label">PICKS DUE</span>
        <span className="countdown-time">Schedule TBD</span>
        {tournamentDay && <span className="countdown-day">{tournamentDay}</span>}
      </div>
    );
  }

  const isExpired = timeLeft === 0;
  const isUrgent = timeLeft !== null && timeLeft > 0 && timeLeft < 15 * 60 * 1000;
  const isShort = timeLeft !== null && timeLeft > 0 && timeLeft < 60 * 60 * 1000;

  const formatTime = (ms) => {
    if (ms <= 0) return '00:00:00';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (isShort) {
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const lockTime = new Date(lockedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const urgencyClass = isExpired ? 'expired' : isUrgent ? 'urgent' : isShort ? 'warning' : '';

  return (
    <div className={`survivor-countdown ${urgencyClass}`}>
      {isExpired ? (
        <>
          <span className="countdown-lock-icon">🔒</span>
          <span className="countdown-label">PICKS LOCKED</span>
        </>
      ) : (
        <>
          <span className="countdown-label">PICKS DUE IN</span>
          <span className="countdown-time">{formatTime(timeLeft)}</span>
        </>
      )}
      <span className="countdown-day">
        {tournamentDay || ''}
        {!isExpired && ` — First game at ${lockTime}`}
      </span>
    </div>
  );
};

export default SurvivorCountdown;
