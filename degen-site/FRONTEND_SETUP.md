# Frontend AWS S3 Setup Guide (Development)

This guide will help you deploy your React frontend to AWS S3 for development.

## Prerequisites

✅ AWS CLI installed and configured
✅ AWS credentials set up

## Step 1: Choose Your GraphQL Backend

Before building, decide where your GraphQL server will be:

**Option A: Local Development** (recommended for now)
- GraphQL runs on your local machine
- URL: `http://localhost:4000/graphql`
- You'll need to update the frontend later to use a public endpoint

**Option B: Public GraphQL Endpoint**
- If you already have a GraphQL server deployed
- URL: `https://your-graphql-domain.com/graphql`

For now, we'll set it up to point to localhost. You can change it later.

## Step 2: Configure Environment Variables

Create or update your `.env` file in the project root:

```env
# GraphQL Endpoint (for local dev, use localhost)
# Change this to your deployed GraphQL endpoint later
REACT_APP_GRAPHQL_ENDPOINT=http://localhost:4000/graphql

# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET_NAME=sports-hub-frontend-dev
```

**Note**: For development, you can keep `localhost:4000/graphql`. Once you deploy the backend, update this URL.

## Step 3: Run the Setup Script

The setup script will:
1. Create an S3 bucket
2. Configure it for static website hosting
3. Set up CORS and permissions
4. Build your React app
5. Upload the build to S3

```bash
npm run setup-frontend-s3
```

Or if you want to specify a custom bucket name:

```bash
S3_BUCKET_NAME=my-custom-bucket-name npm run setup-frontend-s3
```

## Step 4: Access Your Site

After setup completes, you'll get a website URL like:
```
http://your-bucket-name.s3-website-us-east-1.amazonaws.com
```

## Important Notes for Development

### CORS Issues

Since your frontend is on S3 and GraphQL is on localhost, you'll have CORS issues. You have a few options:

**Option 1: Test locally first**
- Run `npm start` locally
- Test everything works
- Deploy to S3 for sharing/showing

**Option 2: Use a public tunnel** (for testing)
- Use ngrok or similar to expose localhost
- Update `REACT_APP_GRAPHQL_ENDPOINT` to the tunnel URL
- Rebuild and redeploy

**Option 3: Deploy backend first**
- Deploy GraphQL server to AWS
- Update frontend env variable
- Rebuild and redeploy

### Updating the Frontend

After making changes:

```bash
# Build
npm run build

# Deploy
aws s3 sync build/ s3://your-bucket-name/ --delete
```

Or use the script:
```bash
npm run deploy-frontend
```

## Cost

S3 static hosting is very cheap:
- Storage: ~$0.023 per GB/month
- Data transfer: Free (first 100GB/month)
- Requests: ~$0.005 per 1,000 requests

**Estimated cost**: $0.50 - $2/month for development use

## Next Steps

1. ✅ Frontend deployed to S3
2. ⏭️ Deploy GraphQL backend (EC2/Lambda/etc)
3. ⏭️ Update frontend to point to deployed backend
4. ⏭️ Set up custom domain (optional)
5. ⏭️ Add CloudFront CDN (optional, for production)

## Troubleshooting

### "Bucket name already exists"
- Choose a different bucket name (must be globally unique)
- Or use the existing bucket

### "Access Denied"
- Check your IAM permissions
- You need: `s3:CreateBucket`, `s3:PutBucketWebsite`, `s3:PutBucketPolicy`

### Site shows "Access Denied" or blank page
- Check bucket policy is set correctly
- Verify public access block settings
- Check if index.html exists in the bucket

### GraphQL requests fail
- Check CORS settings on your GraphQL server
- Verify the endpoint URL is correct
- Check browser console for errors

