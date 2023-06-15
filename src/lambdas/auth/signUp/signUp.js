const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

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
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'User signed up successfully' }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: error.message,
                code: error.code,
            }),
        };
    }
};