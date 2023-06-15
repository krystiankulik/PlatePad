const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const {name} = event.pathParameters;
    const cognitoUserId = event.requestContext.authorizer.claims.sub; // Extract user ID from Cognito authentication token

    // Define get params for user-specific recipe and global recipe
    const getParams = [{
        TableName: 'platepad_recipes', Key: {
            'userId': cognitoUserId, 'name': name
        }
    }, {
        TableName: 'platepad_recipes', Key: {
            'userId': 'global', 'name': name
        }
    }];

    let recipe;
    try {
        // First, try to get user-specific recipe
        const userRecipeData = await docClient.get(getParams[0]).promise();
        if (userRecipeData.Item) {
            recipe = userRecipeData.Item;
        } else {
            // If no user-specific recipe, try to get global recipe
            const globalRecipeData = await docClient.get(getParams[1]).promise();
            if (globalRecipeData.Item) {
                recipe = globalRecipeData.Item;
            } else {
                return {
                    statusCode: 404, body: JSON.stringify({message: "Recipe not found"}),
                };
            }
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500, body: JSON.stringify(error),
        };
    }

    // Retrieve all ingredients
    const ingredientNames = recipe.ingredientValues.map(iv => iv.ingredient);
    const ingredientPromises = ingredientNames.map(ingredientName => {
        return Promise.all([docClient.get({
            TableName: 'platepad_ingredients', Key: {'userId': cognitoUserId, 'name': ingredientName}
        }).promise(), docClient.get({
            TableName: 'platepad_ingredients', Key: {'userId': 'global', 'name': ingredientName}
        }).promise()]);
    });

    let ingredientValues;
    try {
        ingredientValues = await Promise.all(ingredientPromises);
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500, body: JSON.stringify(error),
        };
    }

    // Replace ingredient names with actual ingredient objects
    recipe.ingredientValues = recipe.ingredientValues.map((iv, index) => {
        // Use user-specific ingredient if available, else use global ingredient
        const ingredientItem = ingredientValues[index][0].Item || ingredientValues[index][1].Item;

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
        ingredientValues: recipe.ingredientValues
    };

    return {
        statusCode: 200, body: JSON.stringify(responseBody),
    };
};