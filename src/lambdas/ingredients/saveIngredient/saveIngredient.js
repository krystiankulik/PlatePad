const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const { name, displayName, macro } = JSON.parse(event.body);

    const cognitoRole = event.requestContext.authorizer.claims["custom:role"];
    const userId = cognitoRole === "admin" ? "global" : event.requestContext.authorizer.claims.sub;


    // Check if the principalId is present
    if (!userId) {
        return transformResponse({
            statusCode: 401, body: JSON.stringify({ message: 'Unauthorized. No userId found.' })
        });
    }

    const { calories, proteins, fats, carbohydrates } = macro;

    // Check if an ingredient with the same name and userId 'global' already exists in the database
    const globalCheckParams = {
        TableName: 'platepad_ingredients', Key: {
            "userId": 'global', "name": name
        }
    };

    try {
        const globalCheckResult = await docClient.get(globalCheckParams).promise();
        const globalExistingItem = globalCheckResult.Item;

        // If the item exists, return 400
        if (globalExistingItem) {
            return transformResponse({
                statusCode: 400, body: JSON.stringify({ message: 'Ingredient with this name already exists globally.' })
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify({
                message: error.message, code: error.code
            }),
        });
    }

    // Check if an ingredient with the same name and current userId already exists in the database
    const getParams = {
        TableName: 'platepad_ingredients', Key: {
            "userId": userId, "name": name
        }
    };

    try {
        const getResult = await docClient.get(getParams).promise();
        const existingItem = getResult.Item;

        // If the item exists, return 400
        if (existingItem) {
            return transformResponse({
                statusCode: 400,
                body: JSON.stringify({ message: 'Ingredient with this name already exists for this user.' })
            });
        }

        // If no ingredient with the same name and user ID exists, add the new ingredient
        const putParams = {
            TableName: 'platepad_ingredients', Item: {
                userId: userId,
                name,
                displayName,
                displayNameLowerCase: displayName.toLowerCase(),
                macro: {
                    calories, proteins, fats, carbohydrates
                }
            }
        };
        await docClient.put(putParams).promise();

        return transformResponse({
            statusCode: 201, body: JSON.stringify({ message: 'Object created successfully' })
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