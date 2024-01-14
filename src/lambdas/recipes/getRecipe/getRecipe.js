const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const { name } = event.pathParameters;
    const cognitoUserId = event.requestContext.authorizer.claims.sub; // Extract user ID from Cognito authentication token

    // Define get params for user-specific recipe
    const params = {
        TableName: 'platepad_recipes',
        Key: { 'userId': cognitoUserId, 'name': name }
    };

    let recipe;
    try {
        // First, try to get user-specific recipe
        const userRecipeData = await docClient.get(params).promise();
        if (userRecipeData.Item) {
            recipe = userRecipeData.Item;
        } else {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({ message: "Recipe not found" }),
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }

    // Function to retrieve ingredient data
    async function getIngredient(ingredientName, userId) {
        try {
            const response = await docClient.get({
                TableName: 'platepad_ingredients',
                Key: { 'userId': userId, 'name': ingredientName }
            }).promise();
            return response.Item ? response.Item : null;
        } catch (error) {
            console.error('Error fetching ingredient:', error);
            return null;
        }
    }

    // Retrieve all ingredients, trying user-specific first, then global
    for (let iv of recipe.ingredientValues) {
        let ingredientItem = await getIngredient(iv.ingredient, cognitoUserId);
        if (!ingredientItem) {
            // Try to fetch global ingredient if user-specific one not found
            ingredientItem = await getIngredient(iv.ingredient, 'global');
        }
        if (ingredientItem) {
            iv.ingredient = {
                name: ingredientItem.name,
                displayName: ingredientItem.displayName,
                macro: ingredientItem.macro
            };
        }
    }

    // Return explicitly mapped recipe
    const responseBody = {
        name: recipe.name,
        displayName: recipe.displayName,
        macro: recipe.macro,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredientValues: recipe.ingredientValues
    };

    return transformResponse({
        statusCode: 200, body: JSON.stringify(responseBody),
    });
};