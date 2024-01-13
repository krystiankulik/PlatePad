const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async () => {

    try {
        // Fetch all the recipes for the user or globally
        const recipeData = await docClient.query({
            TableName: 'platepad_recipes',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': 'global'
            }
        }).promise();

        // Iterate over each recipe
        const recipes = await Promise.all(recipeData.Items.map(async (recipe) => {
            // For each ingredient in the recipe, fetch its data
            recipe.ingredientValues = await Promise.all(recipe.ingredientValues.map(async (ingredientValue) => {
                const ingredientName = ingredientValue.ingredient;

                // Try to fetch user-specific ingredient first
                let ingredientData = await docClient.get({
                    TableName: 'platepad_ingredients',
                    Key: {
                        'userId': cognitoUserId,
                        'name': ingredientName
                    }
                }).promise();

                // If user-specific ingredient is not found, try to fetch global ingredient
                if (!ingredientData.Item) {
                    ingredientData = await docClient.get({
                        TableName: 'platepad_ingredients',
                        Key: {
                            'userId': 'global',
                            'name': ingredientName
                        }
                    }).promise();
                }

                const ingredient = ingredientData.Item;
                ingredientValue.ingredient = {
                    "name": ingredient.name,
                    "displayName": ingredient.displayName,
                    "macro": ingredient.macro
                };

                return ingredientValue;
            }));

            // Return explicitly mapped recipe
            return {
                "name": recipe.name,
                "displayName": recipe.displayName,
                "macro": recipe.macro,
                "description": recipe.description,
                "imageUrl": recipe.imageUrl,
                "ingredientValues": recipe.ingredientValues
            };
        }));

        return transformResponse({
            statusCode: 200,
            body: JSON.stringify(recipes)
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
