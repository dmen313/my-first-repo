# MLB Degen Site

This is an MLB team tracking application that displays team standings, World Series odds, and payout calculations.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Setup

### Environment Variables

To get live data, you'll need to set up API keys:

#### The Odds API (for live odds data)
1. Go to [The Odds API](https://the-odds-api.com/) and sign up for a free account
2. Get your API key from the dashboard
3. Add to your `.env.local` file:

```
REACT_APP_ODDS_API_KEY=your_actual_api_key_here
```

#### NFL API (for NFL team data)
The NFL API key is already configured in the `.env.local` file:

```
REACT_APP_NFL_API_KEY=217f8b9d2cmshea956f1ba58e9ecp1c47d0jsn7632a85c4c29
```

**Note:** 
- Replace `your_actual_api_key_here` with your real Odds API key
- Without the Odds API key, the app will use static fallback odds data
- The NFL API key is provided and will fetch live NFL team data

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Data Management Scripts

### NCAA Football Mapping Table

The application includes scripts for managing the NCAA Football team mapping table:

#### `npm run repopulate-mappings`
Repopulates the team mapping table with hardcoded essential data and fetches additional information from external APIs. Use this script if the mapping table gets truncated or corrupted.

**Features:**
- Hardcoded data for 89+ NCAA teams across all major conferences
- Fetches team metadata from College Football Data API
- Fetches current odds from The Odds API
- Handles API failures gracefully
- Prevents duplicate entries

#### `npm run export-mappings`
Exports the entire mapping table to a timestamped CSV file for backup or analysis.

#### `npm run repopulate-ncaa-teams`
Truncates and repopulates NCAA 2025 teams in the team table using the mapping table and live API data. Use this script to refresh team data with current records and odds.

**Features:**
- Deletes all existing NCAA 2025 teams before creating new ones
- Uses team mappings to get correct team names and IDs
- Fetches live records from College Football Data API
- Fetches live championship odds from The Odds API
- Creates teams with proper conference assignments
- Handles API failures gracefully

**Prerequisites:**
- GraphQL server running on port 4000
- Environment variables set up (see Setup section above)
- Team mappings must exist (run `repopulate-mappings` first if needed)

**Usage:**
```bash
# Repopulate mapping table
npm run repopulate-mappings

# Repopulate NCAA teams with live data
npm run repopulate-ncaa-teams

# Export mapping table to CSV
npm run export-mappings
```

For detailed documentation, see `scripts/README.md`.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
