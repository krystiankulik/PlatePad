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
sam deploy  --parameter-overrides CognitoUserPoolArn="<CognitoUserPoolArn>" CognitoUserId="<CognitoUserId>"
```

## Cleanup


```bash
sam delete --stack-name platepad
```
Also, remove the Cognito configuration from the AWS Console  


## Setting an admin user for global recipes and ingredients
To be able to add global recipes and ingredients we need to have an admin user.  
All the items saved with this user will have "global" userId.  
To do it assign a custom attribute for a chosed unser in the Cognito console - custom:role=admin
You have to also configure the read/write access to that attribute in "Attribute read and write permissions" section somewhere in "App integration" settings. Be sure to create a new user token after this setting is set up.
