const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const { email, password } = JSON.parse(event.body);

    const params = {
        ClientId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
        Password: password,
        UserAttributes: [
            {
                Name: 'email',
                Value: email,
            },
        ],
    };

    try {
        await cognito.signUp(params).promise();
        return transformResponse({
            statusCode: 200,
            body: JSON.stringify({ message: 'User signed up successfully' }),
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500,
            body: JSON.stringify({
                message: error.message,
                code: error.code,
            }),
        });
    }
};