const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const params = {
        TableName: 'platepad_recipes',
        Key: {
            'userId': userId,
            'name': event.pathParameters.name
        }
    };

    try {
        const data = await docClient.get(params).promise();

        if (!data.Item) {
            return transformResponse({
                statusCode: 404,
                body: JSON.stringify({message: 'Recipe not found'}),
            });
        }

        await docClient.delete(params).promise();
        return transformResponse({
            statusCode: 200,
            body: JSON.stringify({message: 'Recipe deleted successfully'}),
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500,
            body: JSON.stringify({
                message: error.message,
                code: error.code
            }),
        });
    }
};