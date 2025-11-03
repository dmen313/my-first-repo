import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="baseball">
          <div className="stitch"></div>
          <div className="stitch"></div>
          <div className="stitch"></div>
          <div className="stitch"></div>
        </div>
        <div className="loading-text">
          <h2>Loading MLB Data...</h2>
          <p>Fetching real-time team statistics</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
