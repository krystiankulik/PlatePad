const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const {name} = event.pathParameters;
    const {sub: userId} = event.requestContext.authorizer.claims;

    const params = {
        TableName: 'platepad_ingredients', Key: {
            'userId': userId, 'name': name,
        },
    };

    try {
        // Check if the ingredient to be deleted exists
        const data = await docClient.get(params).promise();
        if (!data.Item) {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({message: 'Ingredient not found'}),
            });
        }

        // Delete the ingredient
        await docClient.delete(params).promise();

        return transformResponse({
            statusCode: 200, body: JSON.stringify({message: 'Ingredient deleted successfully'}),
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }
};