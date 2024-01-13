const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    // Extract the array of ingredients from the event body
    const ingredients = JSON.parse(event.body);

    const cognitoRole = event.requestContext.authorizer.claims["custom:role"];
    
    // Ensure that the role is admin, else return access denied
    if (cognitoRole !== "admin") {
        return transformResponse({
            statusCode: 403, body: JSON.stringify({ message: 'Access Denied. This feature is only available for admin.' })
        });
    }
    
    const userId = "global"; // Since it's for admin only, set userId as global

    // Check for existing ingredients with the same names globally
    const checkPromises = ingredients.map(ingredient => {
        const checkParams = {
            TableName: 'platepad_ingredients',
            Key: {
                "userId": 'global',
                "name": ingredient.name
            }
        };
        return docClient.get(checkParams).promise();
    });
    try {
        const checkResults = await Promise.all(checkPromises);
        for (const result of checkResults) {
            if (result.Item) {
                return transformResponse({
                    statusCode: 400,
                    body: JSON.stringify({ message: `Ingredient with the name ${result.Item.name} already exists globally.` })
                });
            }
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify({
                message: error.message, code: error.code
            }),
        });
    }

    // Prepare the batch write items
    const batchWriteItems = ingredients.map(ingredient => ({
        PutRequest: {
            Item: {
                userId: userId,
                name: ingredient.name,
                displayName: ingredient.displayName,
                displayNameLowerCase: ingredient.displayName.toLowerCase(),
                macro: ingredient.macro
            }
        }
    }));

    const batchWriteParams = {
        RequestItems: {
            'platepad_ingredients': batchWriteItems
        }
    };

    try {
        await docClient.batchWrite(batchWriteParams).promise();
        return transformResponse({
            statusCode: 201, body: JSON.stringify({ message: 'Ingredients created successfully' })
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify({
                message: error.message, code: error.code
            }),
        });
    }
};
