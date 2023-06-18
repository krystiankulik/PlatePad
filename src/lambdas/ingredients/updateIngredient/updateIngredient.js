const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const name = event.pathParameters.name;
    const {sub: userId} = event.requestContext.authorizer.claims;
    const ingredientDetails = JSON.parse(event.body);

    // Check if the ingredient exists
    const queryParams = {
        TableName: 'platepad_ingredients',
        KeyConditionExpression: 'userId = :userId and #n = :name',
        ExpressionAttributeValues: {
            ':userId': userId, ':name': name
        },
        ExpressionAttributeNames: {
            '#n': 'name'
        }
    };

    try {
        const queryData = await docClient.query(queryParams).promise();
        if (!queryData.Items || queryData.Items.length === 0) {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({message: "Ingredient not found"}),
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }

    // Update existing item with new details (excluding name and userId)
    const updatedItem = {
        userId, name, ...ingredientDetails
    };

    // Save updated item back to DB
    const putParams = {
        TableName: 'platepad_ingredients', Item: updatedItem
    };

    try {
        await docClient.put(putParams).promise();
        return transformResponse({
            statusCode: 204
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }
};
