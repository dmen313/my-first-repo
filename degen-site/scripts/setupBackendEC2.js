#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const REGION = process.env.AWS_REGION || 'us-east-1';
const INSTANCE_TYPE = process.env.EC2_INSTANCE_TYPE || 't3.micro';
const DEPLOYMENT_BUCKET = process.env.DEPLOYMENT_BUCKET || `sports-hub-deploy-${Date.now()}`;

console.log('🚀 Setting up GraphQL Backend on AWS EC2\n');
console.log(`Region: ${REGION}`);
console.log(`Instance Type: ${INSTANCE_TYPE}\n`);

async function main() {
  try {
    // Step 1: Create deployment package
    console.log('📦 Creating deployment package...');
    const packageDir = path.join(__dirname, '..', 'deploy');
    if (fs.existsSync(packageDir)) {
      execSync(`rm -rf ${packageDir}`, { stdio: 'ignore' });
    }
    fs.mkdirSync(packageDir, { recursive: true });

    // Copy necessary files
    ['src', 'scripts', 'package.json', 'ecosystem.config.js'].forEach(file => {
      const src = path.join(__dirname, '..', file);
      const dest = path.join(packageDir, file);
      if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
          execSync(`cp -r "${src}" "${dest}"`, { stdio: 'ignore' });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    });

    fs.mkdirSync(path.join(packageDir, 'data'), { recursive: true });

    // Create .env
    const envContent = `NODE_ENV=production
GRAPHQL_PORT=4000
REACT_APP_ODDS_API_KEY=${process.env.REACT_APP_ODDS_API_KEY || ''}
REACT_APP_NFL_API_KEY=${process.env.REACT_APP_NFL_API_KEY || ''}
AWS_REGION=${REGION}
`;
    fs.writeFileSync(path.join(packageDir, '.env'), envContent);

    // Create user data script for EC2
    const userDataScript = `#!/bin/bash
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git unzip

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/sports-hub
cd /home/ec2-user/sports-hub

# Download deployment package from S3
aws s3 cp s3://${DEPLOYMENT_BUCKET}/deploy.zip /tmp/deploy.zip

# Extract
unzip -q /tmp/deploy.zip -d .
rm /tmp/deploy.zip

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo "✅ Deployment complete"
`;

    fs.writeFileSync(path.join(packageDir, 'user-data.sh'), userDataScript);

    // Create zip
    console.log('📦 Creating deployment zip...');
    const zipPath = path.join(__dirname, '..', 'deploy.zip');
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✅ Package created: ${zipPath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)\n`);
        resolve();
      });
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(packageDir, false);
      archive.finalize();
    });

    // Step 2: Create S3 bucket and upload
    console.log('📤 Uploading to S3...');
    try {
      execSync(`aws s3 mb s3://${DEPLOYMENT_BUCKET} --region ${REGION}`, { stdio: 'ignore' });
    } catch (e) {
      // Bucket might already exist
    }
    execSync(`aws s3 cp ${zipPath} s3://${DEPLOYMENT_BUCKET}/deploy.zip --region ${REGION}`, { stdio: 'inherit' });
    console.log('✅ Uploaded to S3\n');

    // Step 3: Get security group
    console.log('🔒 Setting up security group...');
    let securityGroupId;
    try {
      const sgResult = execSync(`aws ec2 describe-security-groups --group-names sports-hub-graphql-sg --region ${REGION} --query "SecurityGroups[0].GroupId" --output text 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (sgResult && sgResult !== 'None') {
        securityGroupId = sgResult;
        console.log(`✅ Using existing security group: ${securityGroupId}`);
      }
    } catch (e) {
      // Create security group
      console.log('Creating security group...');
      const vpcResult = execSync(`aws ec2 describe-vpcs --region ${REGION} --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text`, { encoding: 'utf-8' }).trim();
      const vpcId = vpcResult;
      
      securityGroupId = execSync(`aws ec2 create-security-group --group-name sports-hub-graphql-sg --description "Sports Hub GraphQL Server" --vpc-id ${vpcId} --region ${REGION} --query "GroupId" --output text`, { encoding: 'utf-8' }).trim();
      
      // Add rules
      execSync(`aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ${REGION}`, { stdio: 'ignore' });
      execSync(`aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region ${REGION}`, { stdio: 'ignore' });
      
      console.log(`✅ Created security group: ${securityGroupId}`);
    }

    // Step 4: Create/Get IAM role for EC2
    console.log('\n🔑 Setting up IAM role...');
    const roleName = 'sports-hub-ec2-role';
    let iamRoleArn;
    
    try {
      iamRoleArn = execSync(`aws iam get-role --role-name ${roleName} --query "Role.Arn" --output text 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (iamRoleArn && iamRoleArn !== 'None') {
        console.log(`✅ Using existing IAM role: ${iamRoleArn}`);
      }
    } catch (e) {
      console.log('Creating IAM role...');
      // Create trust policy
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: 'ec2.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }]
      };
      fs.writeFileSync('/tmp/trust-policy.json', JSON.stringify(trustPolicy));
      
      execSync(`aws iam create-role --role-name ${roleName} --assume-role-policy-document file:///tmp/trust-policy.json --region ${REGION}`, { stdio: 'ignore' });
      
      // Attach S3 read policy
      execSync(`aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess`, { stdio: 'ignore' });
      
      // Create instance profile
      try {
        execSync(`aws iam create-instance-profile --instance-profile-name ${roleName}`, { stdio: 'ignore' });
      } catch (e) {}
      execSync(`aws iam add-role-to-instance-profile --instance-profile-name ${roleName} --role-name ${roleName}`, { stdio: 'ignore' });
      
      iamRoleArn = execSync(`aws iam get-role --role-name ${roleName} --query "Role.Arn" --output text`, { encoding: 'utf-8' }).trim();
      console.log(`✅ Created IAM role: ${iamRoleArn}`);
      
      console.log('⚠️  Wait 10 seconds for IAM role to propagate...');
      await new Promise(r => setTimeout(r, 10000));
      
      fs.unlinkSync('/tmp/trust-policy.json');
    }

    // Step 5: Get or create key pair
    console.log('\n🔑 Checking for key pair...');
    const keyName = process.env.EC2_KEY_NAME || 'sports-hub-key';
    
    try {
      execSync(`aws ec2 describe-key-pairs --key-names ${keyName} --region ${REGION}`, { stdio: 'ignore' });
      console.log(`✅ Key pair exists: ${keyName}`);
      console.log(`   Make sure you have the private key: ~/.ssh/${keyName}.pem\n`);
    } catch (e) {
      console.log(`⚠️  Key pair ${keyName} not found.`);
      console.log(`   Creating key pair...`);
      // Ensure .ssh directory exists
      const sshDir = require('os').homedir() + '/.ssh';
      const fs = require('fs');
      if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { mode: 0o700 });
      }
      // Create key pair and save to file
      const keyMaterial = execSync(`aws ec2 create-key-pair --key-name ${keyName} --region ${REGION} --query "KeyMaterial" --output text`, { encoding: 'utf-8' });
      fs.writeFileSync(`${sshDir}/${keyName}.pem`, keyMaterial.trim(), { mode: 0o400 });
      console.log(`✅ Created key pair and saved to ~/.ssh/${keyName}.pem\n`);
    }

    // Step 6: Launch EC2 instance
    console.log('🚀 Launching EC2 instance...');
    const userDataBase64 = Buffer.from(fs.readFileSync(path.join(packageDir, 'user-data.sh')).toString()).toString('base64');
    
    // Get latest Amazon Linux 2 AMI ID
    // Using a current Amazon Linux 2 AMI ID for us-east-1
    // Common AMI IDs for Amazon Linux 2 in us-east-1 (these change frequently)
    const amiIds = {
      'us-east-1': 'ami-0c02fb55956c7d316', // Amazon Linux 2 (updated)
      'us-east-2': 'ami-0c55b159cbfafe1f0',
      'us-west-1': 'ami-0c65adc9a5c1b5d7c',
      'us-west-2': 'ami-0c65adc9a5c1b5d7c'
    };
    
    let amiId = amiIds[REGION] || amiIds['us-east-1'];
    console.log(`📋 Using Amazon Linux 2 AMI: ${amiId} for region ${REGION}`);
    
    const launchParams = {
      ImageId: amiId,
      InstanceType: INSTANCE_TYPE,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: [securityGroupId],
      IamInstanceProfile: { Name: roleName },
      KeyName: keyName,
      UserData: userDataBase64,
      TagSpecifications: [{
        ResourceType: 'instance',
        Tags: [{ Key: 'Name', Value: 'sports-hub-graphql' }]
      }]
    };

    fs.writeFileSync('/tmp/launch-params.json', JSON.stringify(launchParams, null, 2));
    
    const launchResult = JSON.parse(execSync(`aws ec2 run-instances --cli-input-json file:///tmp/launch-params.json --region ${REGION}`, { encoding: 'utf-8' }));
    const instanceId = launchResult.Instances[0].InstanceId;
    
    console.log(`✅ Instance launching: ${instanceId}`);
    console.log('⏳ Waiting for instance to be running...');
    
    execSync(`aws ec2 wait instance-running --instance-ids ${instanceId} --region ${REGION}`, { stdio: 'inherit' });
    
    // Get public IP
    const instanceInfo = JSON.parse(execSync(`aws ec2 describe-instances --instance-ids ${instanceId} --region ${REGION} --query "Reservations[0].Instances[0]"`, { encoding: 'utf-8' }));
    const publicIp = instanceInfo.PublicIpAddress;
    
    console.log('\n✅ Deployment Complete!');
    console.log(`📋 Instance ID: ${instanceId}`);
    console.log(`🌐 Public IP: ${publicIp}`);
    console.log(`🔗 GraphQL Endpoint: http://${publicIp}:4000/graphql`);
    console.log(`🏥 Health Check: http://${publicIp}:4000/health\n`);
    
    console.log('⏳ Waiting 2 minutes for application to install and start...');
    console.log('   (You can monitor progress by SSHing into the instance)\n');
    
    console.log('📝 Next Steps:');
    console.log('1. Update frontend .env:');
    console.log(`   REACT_APP_GRAPHQL_ENDPOINT=http://${publicIp}:4000/graphql`);
    console.log('2. Rebuild and redeploy frontend');
    console.log('3. Test the endpoint\n');
    
    console.log(`💡 To SSH: ssh -i ~/.ssh/${keyName}.pem ec2-user@${publicIp}`);
    console.log(`💡 To check logs: ssh into instance and run: pm2 logs\n`);
    
    fs.unlinkSync('/tmp/launch-params.json');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check AWS CLI is configured: aws configure');
    console.error('   2. Verify IAM permissions for EC2, S3, IAM');
    console.error('   3. Update AMI ID for your region if needed\n');
    process.exit(1);
  }
}

main();

