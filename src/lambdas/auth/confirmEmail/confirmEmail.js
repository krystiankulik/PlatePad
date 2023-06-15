const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
    const {email, confirmationCode} = JSON.parse(event.body);

    const params = {
        ClientId: process.env.COGNITO_USER_POOL_ID, ConfirmationCode: confirmationCode, Username: email
    };

    try {
        await cognito.confirmSignUp(params).promise();

        return {
            statusCode: 200, body: JSON.stringify({message: 'Email confirmed successfully'})
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500, body: JSON.stringify({message: 'Error confirming email'})
        };
    }
};