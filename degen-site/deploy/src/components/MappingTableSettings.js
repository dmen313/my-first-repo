import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import './MappingTableSettings.css';

const GET_TEAM_MAPPINGS = gql`
  query GetTeamMappings {
    getTeamMappings {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

const EXPORT_MAPPINGS = gql`
  mutation ExportMappings {
    exportMappings
  }
`;

const MappingTableSettings = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('cfbdName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedConference, setSelectedConference] = useState('all');
  const [exportStatus, setExportStatus] = useState('');

  const { loading, error, data, refetch } = useQuery(GET_TEAM_MAPPINGS, {
    fetchPolicy: 'network-only'
  });

  const [exportMappings] = useMutation(EXPORT_MAPPINGS);

  // Get unique conferences for filter
  const conferences = useMemo(() => {
    if (!data?.getTeamMappings) return [];
    const uniqueConferences = [...new Set(data.getTeamMappings.map(m => m.cfbdConference))];
    return uniqueConferences.sort();
  }, [data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!data?.getTeamMappings) return [];

    let filtered = [...data.getTeamMappings]; // Create a copy to avoid read-only array issues

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(mapping => 
        mapping.cfbdName.toLowerCase().includes(term) ||
        mapping.oddsApiName.toLowerCase().includes(term) ||
        mapping.cfbdConference.toLowerCase().includes(term) ||
        mapping.cfbdMascot?.toLowerCase().includes(term) ||
        mapping.oddsApiOdds?.includes(term)
      );
    }

    // Filter by conference
    if (selectedConference !== 'all') {
      filtered = filtered.filter(mapping => mapping.cfbdConference === selectedConference);
    }

    // Sort data
    filtered.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      // Handle numeric sorting for cfbdId and oddsApiOdds
      if (sortField === 'cfbdId') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      } else if (sortField === 'oddsApiOdds') {
        aValue = parseInt(aValue.replace(/[^\d-]/g, '')) || 0;
        bValue = parseInt(bValue.replace(/[^\d-]/g, '')) || 0;
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [data, searchTerm, selectedConference, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = async () => {
    try {
      setExportStatus('Exporting...');
      await exportMappings();
      setExportStatus('Export completed successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      setExportStatus('Export failed: ' + error.message);
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) return <div className="mapping-settings">Loading mapping data...</div>;
  if (error) return <div className="mapping-settings">Error loading mapping data: {error.message}</div>;

  return (
    <div className="mapping-settings">
      <h2>Team Mapping Table Management</h2>
      
      {/* Controls Section */}
      <div className="mapping-controls">
        <div className="control-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search by team name, conference, odds..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="control-group">
          <label>Conference:</label>
          <select
            value={selectedConference}
            onChange={(e) => setSelectedConference(e.target.value)}
            className="conference-select"
          >
            <option value="all">All Conferences</option>
            {conferences.map(conference => (
              <option key={conference} value={conference}>{conference}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <button 
            onClick={handleExport}
            disabled={exportStatus === 'Exporting...'}
            className="export-button"
          >
            {exportStatus === 'Exporting...' ? 'Exporting...' : 'Export to CSV'}
          </button>
          {exportStatus && <span className="export-status">{exportStatus}</span>}
        </div>

        <div className="control-group">
          <button onClick={() => refetch()} className="refresh-button">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mapping-summary">
        <div className="summary-item">
          <span className="summary-label">Total Mappings:</span>
          <span className="summary-value">{data?.getTeamMappings?.length || 0}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Filtered Results:</span>
          <span className="summary-value">{filteredAndSortedData.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Conferences:</span>
          <span className="summary-value">{conferences.length}</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="mapping-table-container">
        <table className="mapping-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('cfbdName')} className="sortable">
                Team Name {getSortIcon('cfbdName')}
              </th>
              <th onClick={() => handleSort('cfbdConference')} className="sortable">
                Conference {getSortIcon('cfbdConference')}
              </th>
              <th onClick={() => handleSort('oddsApiName')} className="sortable">
                Odds API Name {getSortIcon('oddsApiName')}
              </th>
              <th onClick={() => handleSort('oddsApiOdds')} className="sortable">
                Odds {getSortIcon('oddsApiOdds')}
              </th>
              <th onClick={() => handleSort('cfbdId')} className="sortable">
                CFBD ID {getSortIcon('cfbdId')}
              </th>
              <th onClick={() => handleSort('matchType')} className="sortable">
                Match Type {getSortIcon('matchType')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((mapping) => (
              <tr key={mapping.id}>
                <td>
                  <div className="team-info">
                    <span className="team-name">{mapping.cfbdName}</span>
                    {mapping.cfbdMascot && (
                      <span className="team-mascot">({mapping.cfbdMascot})</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="conference-badge">{mapping.cfbdConference}</span>
                </td>
                <td className="odds-api-name">{mapping.oddsApiName}</td>
                <td>
                  <span className={`odds-value ${mapping.oddsApiOdds?.startsWith('+') ? 'positive' : 'negative'}`}>
                    {mapping.oddsApiOdds || 'N/A'}
                  </span>
                </td>
                <td>{mapping.cfbdId}</td>
                <td>
                  <span className={`match-type ${mapping.matchType}`}>
                    {mapping.matchType}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="action-btn edit-btn"
                      title="Edit mapping"
                      onClick={() => console.log('Edit mapping:', mapping.id)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      title="Delete mapping"
                      onClick={() => console.log('Delete mapping:', mapping.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedData.length === 0 && (
          <div className="no-results">
            No mappings found matching your search criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default MappingTableSettings;
