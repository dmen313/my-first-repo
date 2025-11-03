# Cognito Configuration Details

## Your User Pool Information

**User Pool Name**: `simplesiteb37ba593_userpool_b37ba593-dev`  
**User Pool ID**: `us-east-1_MI78r8fcJ`  
**Region**: `us-east-1`

## Available Client Apps

1. **Client Name**: `simpleb37ba593_app_client`
   - **Client ID**: `167vjp3lh92se2o1sp7ajl68c2`

2. **Client Name**: `simpleb37ba593_app_clientWeb` (likely for web)
   - **Client ID**: `41ot70nfi1cvnq6g6aug9ea41i`

## Recommended Configuration

For web applications, use the `_Web` client. Add to your `.env` file:

```env
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_MI78r8fcJ
REACT_APP_COGNITO_CLIENT_ID=41ot70nfi1cvnq6g6aug9ea41i
REACT_APP_AWS_REGION=us-east-1
```

## Next Steps

1. **Add environment variables** to `.env` file (see above)
2. **Restart your dev server** if running
3. **Test login** with a user from your Cognito User Pool

## Note on Client Apps

If the web client doesn't work, try the first client ID:
```env
REACT_APP_COGNITO_CLIENT_ID=167vjp3lh92se2o1sp7ajl68c2
```

The web client typically has CORS configured for browser use, but both should work.

