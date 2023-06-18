const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const name = event.pathParameters.name;
    const {name: _, userId: __, ...recipeDetails} = JSON.parse(event.body);

    // Get existing recipe from DB
    const getParams = {
        TableName: 'platepad_recipes', Key: {
            'userId': userId, 'name': name
        }
    };

    let existingItem;
    try {
        const data = await docClient.get(getParams).promise();
        if (data.Item) {
            existingItem = data.Item;
        } else {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({message: "Recipe not found"}),
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }

    // Check if all ingredients exist, if ingredientValues is provided
    if (recipeDetails.ingredientValues) {
        const ingredientNames = recipeDetails.ingredientValues.map(iv => iv.ingredient);
        for (const ingredientName of ingredientNames) {
            const ingredientDataForUser = await docClient.query({
                TableName: 'platepad_ingredients',
                KeyConditionExpression: '#nameAttr = :n and userId = :u',
                ExpressionAttributeNames: {
                    '#nameAttr': 'name'
                },
                ExpressionAttributeValues: {
                    ':n': ingredientName, ':u': userId
                }
            }).promise();

            const ingredientDataGlobal = await docClient.query({
                TableName: 'platepad_ingredients',
                KeyConditionExpression: '#nameAttr = :n and userId = :g',
                ExpressionAttributeNames: {
                    '#nameAttr': 'name'
                },
                ExpressionAttributeValues: {
                    ':n': ingredientName, ':g': 'global'
                }
            }).promise();

            if (!ingredientDataForUser.Items.length && !ingredientDataGlobal.Items.length) {
                return transformResponse({
                    statusCode: 400, body: JSON.stringify({message: `Ingredient ${ingredientName} does not exist`}),
                });
            }
        }
    }

    // Update existing item with new details
    const updatedItem = {...existingItem, ...recipeDetails};

    // Save updated item back to DB
    const putParams = {
        TableName: 'platepad_recipes', Item: updatedItem
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
