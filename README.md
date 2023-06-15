# PlatePad


## Deploy the application

### Configure AWS SAM
To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* Node.js - [Install Node.js 10](https://nodejs.org/en/), including the NPM package management tool.
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

Set up cognito user pool manually in the AWS Console.  
Set up ALLOW_USER_PASSWORD_AUTH for the cognito user pool.  

Run the following in your shell:

```bash
sam build
sam deploy  --parameter-overrides CognitoUserPoolArn="<CognitoUserPoolArn>"
```

## Cleanup


```bash
sam delete --stack-name platepad
```
Also, remove the Cognito configuration from the AWS Console