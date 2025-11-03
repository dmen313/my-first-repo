# ⚾ MLB Teams Tracker

A modern React web application that displays real-time MLB team statistics and standings using the official MLB Stats API. The app features a beautiful, responsive design with team-specific colors and comprehensive statistics.

## 🚀 Features

- **Real-time MLB Data**: Fetches live team statistics from the official MLB Stats API
- **Team Cards**: Beautiful cards displaying team information, records, and standings
- **Division Filtering**: Filter teams by division (AL East, AL Central, AL West, NL East, NL Central, NL West)
- **League Overview**: Summary statistics for American League and National League
- **Top Teams**: Display of top 5 teams by win percentage
- **Division Breakdown**: Detailed statistics for each division
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Team Colors**: Each team card features the official team colors
- **Loading Animation**: Custom baseball-themed loading spinner
- **Error Handling**: Graceful error handling with retry functionality

## 🛠️ Technology Stack

- **Frontend**: React 18
- **Styling**: CSS3 with modern design patterns
- **API**: MLB Stats API (public, no authentication required)
- **AWS Integration**: Prepared for AWS AppSync GraphQL integration
- **Build Tool**: Create React App
- **Package Manager**: npm

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mlb-teams-app.git
   cd mlb-teams-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000` to view the application.

## 🏗️ Project Structure

```
mlb-teams-app/
├── public/
├── src/
│   ├── components/
│   │   ├── MLBTracker.js          # Main statistics tracker
│   │   ├── MLBTracker.css         # Tracker styling
│   │   ├── TeamCard.js            # Individual team card
│   │   ├── TeamCard.css           # Team card styling
│   │   ├── LoadingSpinner.js      # Loading animation
│   │   └── LoadingSpinner.css     # Spinner styling
│   ├── App.js                     # Main application component
│   ├── App.css                    # Main application styling
│   ├── aws-config.js              # AWS AppSync configuration
│   └── index.js                   # Application entry point
├── package.json
└── README.md
```

## 🎨 Features in Detail

### Team Cards
- Team name and league affiliation
- Current win-loss record with color-coded win percentage
- Division and position in standings
- Games back from division leader
- Venue and city information
- Team-specific color accents

### Statistics Dashboard
- **League Overview**: Total teams, wins, losses, and average win percentage for AL and NL
- **Top 5 Teams**: Ranked by win percentage with special highlighting
- **Division Breakdown**: Detailed statistics for each division

### Filtering and Sorting
- Filter teams by division
- Automatic sorting by win percentage
- Responsive grid layout

## 🔧 AWS AppSync Integration (Future)

The application is prepared for AWS AppSync GraphQL integration:

1. **Configuration**: See `src/aws-config.js` for setup instructions
2. **GraphQL Queries**: Pre-defined queries for team and standings data
3. **Mutations**: Ready for updating team records
4. **Subscriptions**: Real-time updates support

### Setting up AWS AppSync

1. Create an AppSync API in your AWS console
2. Set up the schema for teams and standings
3. Configure environment variables:
   ```bash
   REACT_APP_APPSYNC_GRAPHQL_ENDPOINT=your_endpoint
   REACT_APP_APPSYNC_REGION=us-east-1
   REACT_APP_APPSYNC_AUTH_TYPE=API_KEY
   REACT_APP_APPSYNC_API_KEY=your_api_key
   ```

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop**: Full grid layout with detailed statistics
- **Tablet**: Adjusted grid and card layouts
- **Mobile**: Single-column layout with optimized spacing

## 🎯 API Endpoints Used

- **Teams**: `https://statsapi.mlb.com/api/v1/teams?sportId=1`
- **Standings**: `https://statsapi.mlb.com/api/v1/standings?leagueId={id}&season=2024&standingsTypes=regularSeason`

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to AWS S3/CloudFront
1. Build the application
2. Upload the `build` folder to your S3 bucket
3. Configure CloudFront for optimal performance

### Deploy to Netlify
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `build`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MLB Stats API**: For providing comprehensive baseball data
- **React Community**: For the excellent framework and ecosystem
- **Baseball Fans**: For the inspiration to create this application

## 📞 Support

If you have any questions or need help with the application, please open an issue on GitHub.

---

**⚾ Play Ball!** Enjoy tracking your favorite MLB teams with real-time statistics!
