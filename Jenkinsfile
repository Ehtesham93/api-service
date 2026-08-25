@Library(['mm-dsl'])_
mm_aws_build_nemo3
{
    CLOUD                   = "aws"
    AGENT                   = ""
    REGISTRY_NAME           = "813183298904.dkr.ecr.ap-south-1.amazonaws.com"
    REGISTRY_URL            = "https://813183298904.dkr.ecr.ap-south-1.amazonaws.com"
    IMAGE_NAME              = "lmm-intellicar"
    MODULE_NAME             = "stg-nemo3-api-service-svc"
    CREDENTIALNAME          = "MEML-jenkins-user"
    REGION                  = "ap-south-1"
    NODE_VERSION            = "24.15.0"
    SERVER_FLAG             = "false"
    INSTALL_UNSAFE_PERMISSION="false"
    FORCE_INSTALL           = "false"
    APP_ENV                 = 'STAGING'
}
 
mm_ecs_aws_nemo3
{
    REGISTRY_NAME           = "813183298904.dkr.ecr.ap-south-1.amazonaws.com"
    CLUSTER_NAME            = "intellicar-frontend"
    SERVICE_NAME            = "stg-nemo3-api-service-svc"
    IMAGE_NAME              = "stg-nemo3-api-service-svc"
    CREDENTIALNAME          = "MEML-jenkins-user"
    REGION                  = "ap-south-1"
}

mm_checkov_iac
{
    AGENT                   = ""
    PRISMA_API_URL          = "https://api.ind.prismacloud.io"
}

mm_cxsast_check
{
    AGENT                   = ""
    APP_NAME                = "stg-nemo3-api-service-svc"
}
