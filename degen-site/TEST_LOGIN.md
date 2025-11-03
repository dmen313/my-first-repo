# Testing Cognito Login

## ✅ Configuration Verified

Your Cognito setup is correct:
- **User Pool**: `simplesiteb37ba593_userpool_b37ba593-dev`
- **Client App**: `simpleb37ba593_app_clientWeb`
- **Environment variables**: ✅ All set

## How to Test

### 1. Open Your App

Since your dev server is running on port 3000, open:
```
http://localhost:3000
```

### 2. You Should See

- **Login page** with a gradient background
- Username/Email input field
- Password input field
- "Sign In" button

### 3. Test Login

Use a user from your Cognito User Pool:
- **Username/Email**: The username or email of a user in your pool
- **Password**: The user's password

### 4. Expected Behavior

**Successful Login:**
- Login page disappears
- You see the main Sports Hub app
- Your user avatar appears in the header
- "Sign Out" button appears

**Failed Login:**
- Red error message appears below the form
- Common errors:
  - "Incorrect username or password"
  - "User does not exist"
  - "User is not confirmed" (if email verification required)

## Troubleshooting

### "Cognito not configured" Error

- Check browser console for errors
- Make sure `.env` file has all required variables
- Restart dev server: Stop (Ctrl+C) and run `npm start` again

### "User does not exist"

- Create a user in Cognito User Pool
- Or use an existing user's credentials

### "User is not confirmed"

- Check Cognito console for pending user confirmations
- You may need to confirm the user's email

### Session Persistence Issues

- Check browser console
- Make sure cookies/localStorage are enabled

## Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab**: Look for any errors
- **Network tab**: Check if Cognito API calls are being made
- **Application tab**: Check Local Storage for Cognito tokens

## Creating a Test User

If you need to create a test user:

### Option 1: AWS Console
1. Go to Cognito User Pools
2. Click your pool
3. Go to "Users" tab
4. Click "Create user"
5. Enter username and temporary password
6. User will be forced to change password on first login

### Option 2: AWS CLI
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_MI78r8fcJ \
  --username testuser \
  --temporary-password TempPass123! \
  --region us-east-1
```

## Next Steps After Successful Login

1. ✅ Test logout button
2. ✅ Refresh page (should stay logged in)
3. ✅ Close browser and reopen (should stay logged in)
4. ✅ Test accessing protected routes

