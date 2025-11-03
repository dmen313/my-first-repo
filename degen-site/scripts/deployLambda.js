#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const REGION = process.env.AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'sports-hub-graphql';
const API_NAME = process.env.API_GATEWAY_NAME || 'sports-hub-api';

console.log('🚀 Deploying GraphQL Server to AWS Lambda\n');
console.log(`Region: ${REGION}`);
console.log(`Function: ${FUNCTION_NAME}\n`);

async function main() {
  try {
    // Step 1: Install apollo-server-lambda if not installed
    console.log('📦 Checking dependencies...');
    try {
      require.resolve('apollo-server-lambda');
      console.log('✅ apollo-server-lambda already installed');
    } catch (e) {
      console.log('📦 Installing apollo-server-lambda...');
      execSync('npm install apollo-server-lambda --save', { stdio: 'inherit' });
    }

    // Step 2: Create Lambda package
    console.log('\n📦 Creating Lambda deployment package...');
    const lambdaDir = path.join(__dirname, '..', 'lambda-package');
    if (fs.existsSync(lambdaDir)) {
      execSync(`rm -rf ${lambdaDir}`, { stdio: 'ignore' });
    }
    fs.mkdirSync(lambdaDir, { recursive: true });

    // Copy necessary files only (exclude React build, etc.)
    const filesToCopy = [
      'src/graphql',
      'package.json'
    ];

    // Create src directory structure
    fs.mkdirSync(path.join(lambdaDir, 'src'), { recursive: true });
    
    filesToCopy.forEach(file => {
      const src = path.join(__dirname, '..', file);
      const dest = path.join(lambdaDir, file);
      if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
          execSync(`cp -r "${src}" "${dest}"`, { stdio: 'ignore' });
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      }
    });
    
    // Create minimal package.json with only Lambda dependencies
    const packageJson = JSON.parse(fs.readFileSync(path.join(lambdaDir, 'package.json'), 'utf-8'));
    const lambdaDeps = {
      '@apollo/client': packageJson.dependencies['@apollo/client'],
      'apollo-server-lambda': packageJson.dependencies['apollo-server-lambda'],
      'graphql': packageJson.dependencies['graphql'],
      'graphql-tag': packageJson.dependencies['graphql-tag'],
      'uuid': packageJson.dependencies['uuid'],
      'dotenv': packageJson.dependencies['dotenv'],
      '@aws-sdk/client-dynamodb': packageJson.dependencies['@aws-sdk/client-dynamodb'],
      '@aws-sdk/lib-dynamodb': packageJson.dependencies['@aws-sdk/lib-dynamodb'],
    };
    
    const minimalPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      type: 'module',
      main: 'src/graphql/lambda.js',
      dependencies: lambdaDeps
    };
    
    fs.writeFileSync(
      path.join(lambdaDir, 'package.json'),
      JSON.stringify(minimalPackageJson, null, 2)
    );

    // Install production dependencies
    console.log('📦 Installing production dependencies...');
    process.chdir(lambdaDir);
    execSync('npm install --production', { stdio: 'inherit' });

    // Create Lambda handler entry point if it doesn't exist
    const lambdaHandlerPath = path.join(lambdaDir, 'src', 'graphql', 'lambda.js');
    if (!fs.existsSync(lambdaHandlerPath)) {
      // Copy from template
      const lambdaTemplate = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'graphql', 'lambda.js'),
        'utf-8'
      );
      fs.writeFileSync(lambdaHandlerPath, lambdaTemplate);
    }

    // Create zip file
    console.log('\n📦 Creating deployment zip...');
    const zipPath = path.join(__dirname, '..', 'lambda-deploy.zip');
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', () => {
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log(`✅ Package created: ${zipPath} (${sizeMB} MB)\n`);
        resolve();
      });
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(lambdaDir, false);
      archive.finalize();
    });

    // Step 3: Create or update Lambda function
    console.log('🔧 Creating/updating Lambda function...');
    process.chdir(path.join(__dirname, '..'));

    // Check if function exists
    let functionExists = false;
    try {
      execSync(`aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION}`, { stdio: 'ignore' });
      functionExists = true;
      console.log(`✅ Function ${FUNCTION_NAME} exists, updating...`);
    } catch (e) {
      console.log(`📝 Creating new function ${FUNCTION_NAME}...`);
    }

    // Get or create IAM role for Lambda
    const roleName = 'sports-hub-lambda-role';
    let roleArn;
    
    try {
      roleArn = execSync(`aws iam get-role --role-name ${roleName} --query "Role.Arn" --output text 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (roleArn && roleArn !== 'None') {
        console.log(`✅ Using existing IAM role: ${roleArn}`);
      }
    } catch (e) {
      console.log('Creating IAM role for Lambda...');
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }]
      };
      
      fs.writeFileSync('/tmp/lambda-trust-policy.json', JSON.stringify(trustPolicy));
      execSync(`aws iam create-role --role-name ${roleName} --assume-role-policy-document file:///tmp/lambda-trust-policy.json`, { stdio: 'ignore' });
      execSync(`aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`, { stdio: 'ignore' });
      execSync(`aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess`, { stdio: 'ignore' });
      
      roleArn = execSync(`aws iam get-role --role-name ${roleName} --query "Role.Arn" --output text`, { encoding: 'utf-8' }).trim();
      console.log(`✅ Created IAM role: ${roleArn}`);
      
      // Wait for role to be ready
      console.log('⏳ Waiting for IAM role to be ready...');
      await new Promise(r => setTimeout(r, 10000));
      
      fs.unlinkSync('/tmp/lambda-trust-policy.json');
    }

    if (!functionExists) {
      // Check package size and use S3 if too large
      const zipStats = fs.statSync(zipPath);
      const zipSizeMB = zipStats.size / 1024 / 1024;
      console.log(`📦 Package size: ${zipSizeMB.toFixed(2)} MB`);
      
      let codeParam = '';
      if (zipSizeMB > 50) {
        // Upload to S3 first
        console.log('📤 Package too large for direct upload, uploading to S3 first...');
        const s3Bucket = `sports-hub-lambda-deploy-${Date.now()}`;
        try {
          execSync(`aws s3 mb s3://${s3Bucket} --region ${REGION}`, { stdio: 'ignore' });
        } catch (e) {}
        const s3Key = 'lambda-deploy.zip';
        execSync(`aws s3 cp ${zipPath} s3://${s3Bucket}/${s3Key} --region ${REGION}`, { stdio: 'inherit' });
        codeParam = `--code S3Bucket=${s3Bucket},S3Key=${s3Key}`;
        console.log('✅ Uploaded to S3\n');
      } else {
        codeParam = `--zip-file fileb://${zipPath}`;
      }
      
      console.log('Creating Lambda function...');
      const envVars = {
        NODE_ENV: 'production',
        USE_DYNAMODB: 'true',
        REACT_APP_ODDS_API_KEY: process.env.REACT_APP_ODDS_API_KEY || '',
        REACT_APP_NFL_API_KEY: process.env.REACT_APP_NFL_API_KEY || '',
      };
      
      // Write env vars to temp file for proper JSON handling
      const envFile = '/tmp/lambda-env.json';
      fs.writeFileSync(envFile, JSON.stringify({ Variables: envVars }));
      execSync(`aws lambda create-function --function-name ${FUNCTION_NAME} --runtime nodejs18.x --role ${roleArn} --handler src/graphql/lambda.handler ${codeParam} --timeout 30 --memory-size 512 --environment file://${envFile} --region ${REGION}`, { stdio: 'inherit' });
      fs.unlinkSync(envFile);
      console.log('✅ Lambda function created\n');
    } else {
      // Update function code
      execSync(`aws lambda update-function-code --function-name ${FUNCTION_NAME} --zip-file fileb://${zipPath} --region ${REGION}`, { stdio: 'inherit' });
      console.log('✅ Function code updated\n');
      
      // Update environment variables
      const envVars = {
        NODE_ENV: 'production',
        USE_DYNAMODB: 'true',
        REACT_APP_ODDS_API_KEY: process.env.REACT_APP_ODDS_API_KEY || '',
        REACT_APP_NFL_API_KEY: process.env.REACT_APP_NFL_API_KEY || '',
      };
      const envFile = '/tmp/lambda-env.json';
      fs.writeFileSync(envFile, JSON.stringify({ Variables: envVars }));
      try {
        execSync(`aws lambda update-function-configuration --function-name ${FUNCTION_NAME} --environment file://${envFile} --region ${REGION}`, { stdio: 'ignore' });
      } catch (e) {
        // Environment variables may already be set, continue
        console.log('⚠️  Could not update environment variables (may already be set correctly)');
      }
      if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
    }

    // Step 4: Create or update API Gateway
    console.log('🌐 Setting up API Gateway...');
    let apiId;
    
    try {
      const apis = JSON.parse(execSync(`aws apigateway get-rest-apis --region ${REGION} --query "items[?name=='${API_NAME}'].id" --output json`, { encoding: 'utf-8' }));
      if (apis && apis.length > 0) {
        apiId = apis[0];
        console.log(`✅ Using existing API: ${apiId}`);
      }
    } catch (e) {
      // API doesn't exist
    }

    if (!apiId) {
      // Create REST API
      const apiResult = JSON.parse(execSync(`aws apigateway create-rest-api --name ${API_NAME} --region ${REGION} --endpoint-configuration types=REGIONAL`, { encoding: 'utf-8' }));
      apiId = apiResult.id;
      console.log(`✅ Created API Gateway: ${apiId}`);
    }

    // Get root resource
    const rootResource = JSON.parse(execSync(`aws apigateway get-resources --rest-api-id ${apiId} --region ${REGION} --query "items[?path=='/'].id" --output json`, { encoding: 'utf-8' }))[0];

    // Create or get GraphQL resource
    let graphqlResourceId;
    try {
      const resources = JSON.parse(execSync(`aws apigateway get-resources --rest-api-id ${apiId} --region ${REGION} --query "items[?path=='/graphql'].id" --output json`, { encoding: 'utf-8' }));
      if (resources && resources.length > 0) {
        graphqlResourceId = resources[0];
      }
    } catch (e) {}

    if (!graphqlResourceId) {
      const resource = JSON.parse(execSync(`aws apigateway create-resource --rest-api-id ${apiId} --parent-id ${rootResource} --path-part graphql --region ${REGION}`, { encoding: 'utf-8' }));
      graphqlResourceId = resource.id;
    }

    // Create ANY method (proxy)
    try {
      execSync(`aws apigateway put-method --rest-api-id ${apiId} --resource-id ${graphqlResourceId} --http-method ANY --authorization-type NONE --region ${REGION}`, { stdio: 'ignore' });
    } catch (e) {
      // Method already exists
    }

    // Create integration
    const integrationUri = `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf-8' }).trim()}:function:${FUNCTION_NAME}/invocations`;
    
    execSync(`aws apigateway put-integration --rest-api-id ${apiId} --resource-id ${graphqlResourceId} --http-method ANY --type AWS_PROXY --integration-http-method POST --uri "${integrationUri}" --region ${REGION}`, { stdio: 'ignore' });

    // Grant API Gateway permission to invoke Lambda
    try {
      execSync(`aws lambda add-permission --function-name ${FUNCTION_NAME} --statement-id apigateway-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:*:${apiId}/*/*" --region ${REGION}`, { stdio: 'ignore' });
    } catch (e) {
      // Permission already exists
    }

    // Deploy API
    const deployment = JSON.parse(execSync(`aws apigateway create-deployment --rest-api-id ${apiId} --stage-name prod --region ${REGION}`, { encoding: 'utf-8' }));
    console.log('✅ API Gateway deployed\n');

    const apiUrl = `https://${apiId}.execute-api.${REGION}.amazonaws.com/prod/graphql`;
    
    console.log('✅ Deployment Complete!');
    console.log(`🌐 GraphQL Endpoint: ${apiUrl}`);
    console.log(`🏥 Health Check: ${apiUrl.replace('/graphql', '/health')}\n`);
    
    console.log('📝 Next Steps:');
    console.log('1. Update frontend .env:');
    console.log(`   REACT_APP_GRAPHQL_ENDPOINT=${apiUrl}`);
    console.log('2. Rebuild and redeploy frontend');
    console.log('3. Test the endpoint\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();

