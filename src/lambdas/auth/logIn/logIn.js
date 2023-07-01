const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const {email, password} = JSON.parse(event.body);

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH', ClientId: process.env.COGNITO_USER_POOL_ID, AuthParameters: {
            USERNAME: email, PASSWORD: password
        }
    };

    try {
        const data = await cognito.initiateAuth(params).promise();
        return transformResponse({
            statusCode: 200, body: JSON.stringify({identityToken: data.AuthenticationResult.IdToken})
        });
    } catch (error) {
        console.error(error);

        return transformResponse({
            statusCode: 400, body: JSON.stringify({message: 'Incorrect username or password'})
        });
    }
};