# IAM Permissions Request for Automated Backend Deployment

## Current User
Your AWS user: `arn:aws:iam::503561456148:user/dmenon313`

## Required Permissions

To enable automated backend deployment, you need the following IAM permissions:

### Option 1: Minimal Permissions (Recommended)

Create a new IAM policy called `SportsHubBackendDeployment` with the following JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2InstanceManagement",
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:TerminateInstances",
        "ec2:RebootInstances",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:CreateSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeKeyPairs",
        "ec2:CreateKeyPair",
        "ec2:DeleteKeyPair",
        "ec2:CreateTags",
        "ec2:DescribeTags"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:Region": "us-east-1"
        }
      }
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:CreateInstanceProfile",
        "iam:GetInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:ListInstanceProfilesForRole"
      ],
      "Resource": [
        "arn:aws:iam::503561456148:role/sports-hub-*",
        "arn:aws:iam::503561456148:instance-profile/sports-hub-*"
      ]
    },
    {
      "Sid": "S3DeploymentBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::sports-hub-deploy-*",
        "arn:aws:s3:::sports-hub-deploy-*/*"
      ]
    }
  ]
}
```

### Option 2: Using AWS Managed Policies (Easier, but more permissive)

Ask your administrator to attach these managed policies:
- `AmazonEC2FullAccess` (or create a custom EC2 policy with only needed permissions)
- `IAMFullAccess` (or custom IAM policy for role creation only)
- `AmazonS3FullAccess` (or custom S3 policy for deployment buckets only)

## How to Request Permissions

### If you have IAM access:

1. Go to AWS Console → IAM → Policies
2. Click "Create policy"
3. Choose "JSON" tab
4. Paste the policy JSON above
5. Name it: `SportsHubBackendDeployment`
6. Attach it to your user: `dmenon313`

### If you need to request from administrator:

Send them this email/ticket:

---

**Subject: IAM Permissions Request for Sports Hub Backend Deployment**

Hi,

I need the following AWS IAM permissions to enable automated deployment of the Sports Hub GraphQL backend:

**User**: `dmenon313` (arn:aws:iam::503561456148:user/dmenon313)

**Required Permissions**:
1. **EC2**: Create, describe, and manage EC2 instances and security groups
2. **IAM**: Create IAM roles and instance profiles for EC2 instances
3. **S3**: Create and manage deployment buckets (sports-hub-deploy-*)

**Scope**: 
- Region: `us-east-1`
- Resources: Tagged with `sports-hub-*` where possible

**Security Notes**:
- All resources will be tagged with `Name=sports-hub-graphql`
- Security groups will only allow necessary ports (22, 4000)
- Instance types limited to t3.micro/t3.small

**Attached**: IAM policy JSON file (`IAM_PERMISSIONS_REQUEST.md`)

Thanks!

---

## Verify Permissions

After permissions are granted, verify with:

```bash
# Test EC2 permissions
aws ec2 describe-instances --region us-east-1 --max-items 1

# Test IAM permissions  
aws iam get-role --role-name test-role 2>&1 | head -1

# Test S3 permissions
aws s3 ls | head -5
```

## Once Permissions are Granted

Run the automated deployment:

```bash
npm run setup-backend-ec2
```

This will:
1. ✅ Create deployment package
2. ✅ Upload to S3
3. ✅ Create security group
4. ✅ Create IAM role for EC2
5. ✅ Launch EC2 instance
6. ✅ Configure and start GraphQL server
7. ✅ Provide you with the endpoint URL

## Security Best Practices

The automated script will:
- Use t3.micro instances (cost-effective)
- Tag all resources for easy identification
- Create dedicated security groups with minimal permissions
- Use IAM roles instead of embedding credentials
- Only open necessary ports (22 for SSH, 4000 for GraphQL)

---

**Questions?** Review the deployment script: `scripts/setupBackendEC2.js`

