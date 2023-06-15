const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const {name} = event.pathParameters;
    const {sub: userId} = event.requestContext.authorizer.claims;

    const params = {
        TableName: 'platepad_ingredients', Key: {'userId': userId, 'name': name},
    };

    try {
        const data = await docClient.get(params).promise();

        if (data.Item) {
            const {name, displayName, macro} = data.Item;
            return {
                statusCode: 200, body: JSON.stringify({
                    name, displayName, macro
                })
            };
        } else {
            return {
                statusCode: 404, body: JSON.stringify({message: "Ingredient not found"})
            };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500, body: JSON.stringify(error)
        };
    }
};