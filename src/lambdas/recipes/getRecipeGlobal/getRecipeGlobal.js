const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const { name } = event.pathParameters;

    // Define get params for user-specific recipe and global recipe
    const params = {
        TableName: 'platepad_recipes',
        Key: {
            'userId': 'global', 'name': name
        }
    };

    let recipe;
    try {

        const globalRecipeData = await docClient.get(params).promise();
        if (globalRecipeData.Item) {
            recipe = globalRecipeData.Item;
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

    // Retrieve all ingredients
    const ingredientNames = recipe.ingredientValues.map(iv => iv.ingredient);
    const ingredientPromise = ingredientNames.map(ingredientName =>
        docClient.get({
            TableName: 'platepad_ingredients', Key: { 'userId': 'global', 'name': ingredientName }
        }).promise()
    );

    let ingredientValues;
    try {
        ingredientValues = await Promise.all(ingredientPromise);
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }

    // Replace ingredient names with actual ingredient objects
    recipe.ingredientValues = recipe.ingredientValues.map((iv, index) => {
        // Use user-specific ingredient if available, else use global ingredient
        const ingredientItem = ingredientValues[index].Item;

        // Return explicitly mapped ingredient
        return {
            amount: iv.amount, ingredient: {
                name: ingredientItem.name, displayName: ingredientItem.displayName, macro: ingredientItem.macro
            }
        };
    });

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