const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const recipeDetails = JSON.parse(event.body);
    const ingredients = recipeDetails.ingredientValues.map(item => item.ingredient);

    const cognitoRole = event.requestContext.authorizer.claims["custom:role"];
    const userId = cognitoRole === "admin" ? "global" : event.requestContext.authorizer.claims.sub;

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
                            ':userId': userId,
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
                ':userId': userId,
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
                body: JSON.stringify({ message: 'Recipe already exists for this user or globally.' })
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500,
            body: JSON.stringify(error),
        });
    }

    const getMacro = () => {
        let totalMacro = {
            calories: 0,
            proteins: 0,
            fats: 0,
            carbohydrates: 0,
        };

        for (let i = 0; i < recipeDetails.ingredientValues.length; i++) {
            let ingredientAmount = recipeDetails.ingredientValues[i].amount;

            // Fetch the ingredient either from userIngredient or globalIngredient.
            let ingredient;
            if (ingredientsData[i][0].Items[0]) {
                ingredient = ingredientsData[i][0].Items[0];
            } else {
                ingredient = ingredientsData[i][1].Items[0];
            }

            let multiplier = ingredientAmount / 100; // as macros are given per 100g

            totalMacro.calories += (ingredient.macro.calories || 0) * multiplier;
            totalMacro.proteins += (ingredient.macro.proteins || 0) * multiplier;
            totalMacro.fats += (ingredient.macro.fats || 0) * multiplier;
            totalMacro.carbohydrates += (ingredient.macro.carbohydrates || 0) * multiplier;
        }

        // Round the values to integers
        totalMacro.calories = Math.round(totalMacro.calories);
        totalMacro.proteins = Math.round(totalMacro.proteins);
        totalMacro.fats = Math.round(totalMacro.fats);
        totalMacro.carbohydrates = Math.round(totalMacro.carbohydrates);

        return totalMacro;
    };


    const params = {
        TableName: 'platepad_recipes',
        Item: {
            ...recipeDetails,
            macro: getMacro(),
            userId: userId  // Add userId to the recipe item
        }
    };

    try {
        await docClient.put(params).promise();
        return transformResponse({
            statusCode: 201,
            body: JSON.stringify({ message: 'Object created successfully' })
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