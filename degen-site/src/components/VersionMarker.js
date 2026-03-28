import React, { useState, useEffect } from 'react';
import './VersionMarker.css';

const VersionMarker = () => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Load version info from the version.json file generated during build
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersionInfo(data))
      .catch(err => {
        console.warn('Could not load version info:', err);
        // Fallback version info
        setVersionInfo({
          version: 'dev',
          buildDate: new Date().toLocaleString(),
          gitCommit: 'local'
        });
      });
  }, []);

  if (!versionInfo) return null;

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="version-marker" onClick={() => setIsExpanded(!isExpanded)}>
      <div className="version-badge">
        <span className="version-icon">🔖</span>
        <span className="version-text">
          v{versionInfo.version} • {formatDate(versionInfo.buildDate)}
        </span>
      </div>
      {isExpanded && (
        <div className="version-details">
          <div className="version-detail-item">
            <strong>Version:</strong> {versionInfo.version}
          </div>
          <div className="version-detail-item">
            <strong>Build Date:</strong> {versionInfo.buildDate}
          </div>
          {versionInfo.gitCommit && versionInfo.gitCommit !== 'unknown' && (
            <div className="version-detail-item">
              <strong>Commit:</strong> {versionInfo.gitCommit}
            </div>
          )}
          {versionInfo.gitBranch && versionInfo.gitBranch !== 'unknown' && (
            <div className="version-detail-item">
              <strong>Branch:</strong> {versionInfo.gitBranch}
            </div>
          )}
          {versionInfo.environment && (
            <div className="version-detail-item">
              <strong>Environment:</strong> {versionInfo.environment}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionMarker;

