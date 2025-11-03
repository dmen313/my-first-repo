# AWS Cognito Authentication Setup

## User Pool Information

Your User Pool name: `simplesiteb37ba593_userpool_b37ba593-dev`

**Note**: This looks like an Amplify-generated pool name. The actual User Pool ID format is: `us-east-1_XXXXXXXXX`

## Finding Your User Pool ID and Client ID

### Option 1: AWS Console

1. Go to: https://console.aws.amazon.com/cognito/v2/idp/user-pools?region=us-east-1
2. Find your User Pool (name: `simplesiteb37ba593_userpool_b37ba593-dev`)
3. Click on it to open details
4. On the left sidebar, click **"App integration"** tab
5. Scroll down to **"App clients and analytics"**
6. You'll see your Client ID there

The User Pool ID is shown at the top of the page (format: `us-east-1_XXXXXXXXX`)

### Option 2: AWS CLI

```bash
# List all User Pools
aws cognito-idp list-user-pools --max-results 10 --region us-east-1

# List client apps for a User Pool (replace with actual User Pool ID)
aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_XXXXXXXXX --region us-east-1
```

Or use our helper script:
```bash
# After you have the correct User Pool ID
node scripts/getCognitoClientId.js us-east-1_XXXXXXXXX
```

## Configuration

Once you have both IDs, add to your `.env` file:

```env
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_CLIENT_ID=your_client_id_here
REACT_APP_AWS_REGION=us-east-1
```

## What Was Created

1. ✅ **LoginPage component** - Beautiful login UI
2. ✅ **authService** - Cognito authentication functions
3. ✅ **App.js integration** - Shows login page when not authenticated
4. ✅ **Logout functionality** - Added to HeaderBar and Navigation

## Testing

1. Make sure you have a user in your Cognito User Pool
2. Start your app: `npm start`
3. You should see the login page
4. Enter your Cognito username/email and password
5. After login, you'll see the main app

## Features

- ✅ Login with username/email and password
- ✅ Session persistence (stays logged in on refresh)
- ✅ Automatic authentication check on app load
- ✅ Logout button in header
- ✅ User avatar with initials
- ✅ Error handling and display

## Next Steps

1. Get your User Pool ID and Client ID (see above)
2. Add them to `.env` file
3. Restart your development server
4. Test login with your Cognito user

