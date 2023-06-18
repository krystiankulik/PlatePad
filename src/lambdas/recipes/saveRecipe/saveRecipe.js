const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const recipeDetails = JSON.parse(event.body);
    const ingredients = recipeDetails.ingredientValues.map(item => item.ingredient);
    const cognitoUserId = event.requestContext.authorizer.claims.sub; // Extract user ID from Cognito authentication token
    let ingredientsData;

    try {
        // Query both user-specific and global ingredients
        ingredientsData = await Promise.all(
            ingredients.map(ingredient => {
                return Promise.all([
                    docClient.query({
                        TableName: 'platepad_ingredients',
                        KeyConditionExpression: 'userId = :userId and #n = :name',
                        ExpressionAttributeValues: {
                            ':userId': cognitoUserId,
                            ':name': ingredient
                        },
                        ExpressionAttributeNames: {
                            '#n': 'name'
                        }
                    }).promise(),
                    docClient.query({
                        TableName: 'platepad_ingredients',
                        KeyConditionExpression: 'userId = :globalUser and #n = :name',
                        ExpressionAttributeValues: {
                            ':globalUser': 'global',
                            ':name': ingredient
                        },
                        ExpressionAttributeNames: {
                            '#n': 'name'
                        }
                    }).promise()
                ])
            })
        );
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

    for (let i = 0; i < ingredientsData.length; i++) {
        // Flatten the results
        const [userIngredient, globalIngredient] = ingredientsData[i];
        if (!userIngredient.Items[0] && !globalIngredient.Items[0]) {
            return transformResponse({
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Ingredient not found',
                    ingredient: ingredients[i]
                }),
            });
        }
    }

    // Check if a recipe with the same name and userId already exists in the database
    const queryParams = [
        {
            TableName: 'platepad_recipes',
            KeyConditionExpression: 'userId = :userId and #n = :name',
            ExpressionAttributeValues: {
                ':userId': cognitoUserId,
                ':name': recipeDetails.name
            },
            ExpressionAttributeNames: {
                '#n': 'name'
            }
        },
        {
            TableName: 'platepad_recipes',
            KeyConditionExpression: 'userId = :globalUser and #n = :name',
            ExpressionAttributeValues: {
                ':globalUser': 'global',
                ':name': recipeDetails.name
            },
            ExpressionAttributeNames: {
                '#n': 'name'
            }
        }
    ];

    try {
        const queryData = await Promise.all(queryParams.map(param => docClient.query(param).promise()));
        if ((queryData[0].Items && queryData[0].Items.length > 0) || (queryData[1].Items && queryData[1].Items.length > 0)) {
            return transformResponse({
                statusCode: 400,
                body: JSON.stringify({message: 'Recipe already exists for this user or globally.'})
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500,
            body: JSON.stringify(error),
        });
    }

    const params = {
        TableName: 'platepad_recipes',
        Item: {
            ...recipeDetails,
            userId: cognitoUserId  // Add userId to the recipe item
        }
    };

    try {
        await docClient.put(params).promise();
        return transformResponse({
            statusCode: 201,
            body: JSON.stringify({message: 'Object created successfully'})
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