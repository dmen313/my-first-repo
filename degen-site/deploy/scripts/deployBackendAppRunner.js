#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const APP_NAME = process.env.APP_RUNNER_NAME || 'sports-hub-graphql';
const ECR_REPO_NAME = 'sports-hub-graphql';

console.log('🚀 Deploying GraphQL Backend to AWS App Runner\n');
console.log(`Region: ${REGION}`);
console.log(`App Name: ${APP_NAME}\n`);

async function main() {
  try {
    // Step 1: Get AWS account ID
    console.log('📋 Getting AWS account information...');
    const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf-8' }).trim();
    const ecrRepoUri = `${accountId}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}`;
    
    console.log(`Account ID: ${accountId}`);
    console.log(`ECR Repository URI: ${ecrRepoUri}\n`);

    // Step 2: Create ECR repository if it doesn't exist
    console.log('📦 Setting up ECR repository...');
    try {
      execSync(`aws ecr describe-repositories --repository-names ${ECR_REPO_NAME} --region ${REGION}`, { stdio: 'ignore' });
      console.log(`✅ ECR repository ${ECR_REPO_NAME} already exists`);
    } catch (error) {
      console.log(`Creating ECR repository ${ECR_REPO_NAME}...`);
      execSync(`aws ecr create-repository --repository-name ${ECR_REPO_NAME} --region ${REGION}`, { stdio: 'inherit' });
      console.log('✅ ECR repository created');
    }

    // Step 3: Build and push Docker image
    console.log('\n🏗️  Building Docker image...');
    process.chdir(path.join(__dirname, '..'));
    
    // Login to ECR
    console.log('Logging in to ECR...');
    const loginCmd = `aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${accountId}.dkr.ecr.${REGION}.amazonaws.com`;
    execSync(loginCmd, { stdio: 'inherit' });

    // Build image
    console.log('Building Docker image...');
    execSync(`docker build -t ${ECR_REPO_NAME}:latest .`, { stdio: 'inherit' });

    // Tag image
    console.log('Tagging image...');
    execSync(`docker tag ${ECR_REPO_NAME}:latest ${ecrRepoUri}:latest`, { stdio: 'inherit' });

    // Push image
    console.log('Pushing image to ECR...');
    execSync(`docker push ${ecrRepoUri}:latest`, { stdio: 'inherit' });
    console.log('✅ Docker image pushed\n');

    // Step 4: Create App Runner service
    console.log('🚀 Creating App Runner service...');
    
    // Check if service already exists
    try {
      execSync(`aws apprunner describe-service --service-arn $(aws apprunner list-services --region ${REGION} --query "ServiceSummaryList[?ServiceName=='${APP_NAME}'].ServiceArn" --output text) --region ${REGION}`, { stdio: 'ignore' });
      console.log(`⚠️  App Runner service ${APP_NAME} already exists`);
      console.log('Updating service...');
      
      // Create update JSON
      const updateConfig = {
        SourceConfiguration: {
          ImageRepository: {
            ImageIdentifier: `${ecrRepoUri}:latest`,
            ImageRepositoryType: 'ECR',
            ImageConfiguration: {
              Port: '4000',
              RuntimeEnvironmentVariables: {
                NODE_ENV: 'production',
                GRAPHQL_PORT: '4000',
                REACT_APP_ODDS_API_KEY: process.env.REACT_APP_ODDS_API_KEY || '',
                REACT_APP_NFL_API_KEY: process.env.REACT_APP_NFL_API_KEY || '',
                AWS_REGION: REGION
              }
            }
          },
          AutoDeploymentsEnabled: true
        },
        InstanceConfiguration: {
          Cpu: '0.5 vCPU',
          Memory: '1 GB'
        }
      };

      const configFile = path.join(__dirname, 'apprunner-update-config.json');
      fs.writeFileSync(configFile, JSON.stringify(updateConfig, null, 2));
      
      const serviceArn = execSync(`aws apprunner list-services --region ${REGION} --query "ServiceSummaryList[?ServiceName=='${APP_NAME}'].ServiceArn" --output text`, { encoding: 'utf-8' }).trim();
      
      execSync(`aws apprunner update-service --service-arn ${serviceArn} --source-configuration file://${configFile} --region ${REGION}`, { stdio: 'inherit' });
      fs.unlinkSync(configFile);
      
      console.log('✅ Service updated\n');
    } catch (error) {
      // Service doesn't exist, create it
      console.log('Creating new App Runner service...');
      
      // Create service configuration
      const serviceConfig = {
        ServiceName: APP_NAME,
        SourceConfiguration: {
          ImageRepository: {
            ImageIdentifier: `${ecrRepoUri}:latest`,
            ImageRepositoryType: 'ECR',
            ImageConfiguration: {
              Port: '4000',
              RuntimeEnvironmentVariables: {
                NODE_ENV: 'production',
                GRAPHQL_PORT: '4000',
                REACT_APP_ODDS_API_KEY: process.env.REACT_APP_ODDS_API_KEY || '',
                REACT_APP_NFL_API_KEY: process.env.REACT_APP_NFL_API_KEY || '',
                AWS_REGION: REGION
              }
            },
            AccessRoleArn: `arn:aws:iam::${accountId}:role/service-role/AppRunnerECRAccessRole`
          },
          AutoDeploymentsEnabled: true
        },
        InstanceConfiguration: {
          Cpu: '0.5 vCPU',
          Memory: '1 GB'
        },
        AutoScalingConfigurationArn: undefined // Will use default
      };

      // Create IAM role for App Runner if needed (manual step for now)
      console.log('\n⚠️  Note: You may need to create an IAM role for App Runner to access ECR.');
      console.log('   Role name: AppRunnerECRAccessRole');
      console.log('   Trust policy: App Runner service principal');
      console.log('   Permissions: AmazonEC2ContainerRegistryReadOnly\n');

      const configFile = path.join(__dirname, 'apprunner-config.json');
      fs.writeFileSync(configFile, JSON.stringify(serviceConfig, null, 2));
      
      console.log(`✅ Configuration saved to ${configFile}`);
      console.log('   You can now create the service using:');
      console.log(`   aws apprunner create-service --cli-input-json file://${configFile} --region ${REGION}\n`);
      
      // Try to create anyway
      try {
        execSync(`aws apprunner create-service --cli-input-json file://${configFile} --region ${REGION}`, { stdio: 'inherit' });
        fs.unlinkSync(configFile);
        console.log('✅ App Runner service created\n');
      } catch (createError) {
        console.log('❌ Could not create service automatically. Please:');
        console.log(`   1. Review the config file: ${configFile}`);
        console.log('   2. Create the IAM role if needed');
        console.log(`   3. Run: aws apprunner create-service --cli-input-json file://${configFile} --region ${REGION}\n`);
      }
    }

    // Step 5: Get service URL
    console.log('📡 Getting service URL...');
    try {
      const serviceArn = execSync(`aws apprunner list-services --region ${REGION} --query "ServiceSummaryList[?ServiceName=='${APP_NAME}'].ServiceArn" --output text`, { encoding: 'utf-8' }).trim();
      const serviceInfo = JSON.parse(execSync(`aws apprunner describe-service --service-arn ${serviceArn} --region ${REGION}`, { encoding: 'utf-8' }));
      const serviceUrl = serviceInfo.Service.ServiceUrl;
      
      console.log('\n✅ Deployment Complete!');
      console.log(`🌐 GraphQL Endpoint: https://${serviceUrl}/graphql`);
      console.log(`🏥 Health Check: https://${serviceUrl}/health\n`);
      
      console.log('📝 Next Steps:');
      console.log('1. Update your frontend .env file:');
      console.log(`   REACT_APP_GRAPHQL_ENDPOINT=https://${serviceUrl}/graphql`);
      console.log('2. Rebuild and redeploy frontend');
      console.log('3. Test the endpoint in your browser\n');
      
    } catch (error) {
      console.log('⚠️  Could not get service URL yet. Service may still be deploying.');
      console.log('   Check AWS Console: App Runner > Services\n');
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\n💡 Tip: Make sure Docker is running and you have AWS permissions for:');
    console.error('   - ECR (create repository, push images)');
    console.error('   - App Runner (create/update services)');
    console.error('   - IAM (create roles if needed)\n');
    process.exit(1);
  }
}

main();

